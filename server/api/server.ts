import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Archive, CodeNodeRecord } from '../archive'
import {
  HttpError,
  optionalInteger,
  optionalString,
  readJsonObject,
  requireString,
  sendJson,
  toHttpError,
} from './http'
import { LivePresence, type ControlModule, type SelectKind } from './presence'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const DEFAULT_ALLOWED_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173']
const HEARTBEAT_MS = 25_000
const API = '/api/v1'

export type ControlServerOptions = {
  archive: Archive
  modules: readonly ControlModule[]
  sourceRevision: string
  sourceDirty?: boolean
  host?: string
  port?: number
  // Browser origins allowed to call the API cross-origin, e.g. the dev server.
  allowedOrigins?: readonly string[]
}

export type ControlServer = {
  start(): Promise<{ host: string; port: number; url: string }>
  stop(): Promise<void>
  presence: LivePresence
}

function hostnameOf(hostHeader: string | undefined): string | null {
  if (hostHeader === undefined) return null
  try {
    return new URL(`http://${hostHeader}`).hostname.replace(/^\[|\]$/g, '')
  } catch {
    return null
  }
}

export function createControlServer(options: ControlServerOptions): ControlServer {
  const host = options.host ?? '127.0.0.1'
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`The control API only binds to loopback in M2; refusing host ${host}`)
  }

  const archive = options.archive
  const presence = new LivePresence(archive, options.modules)
  const allowedOrigins = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS)
  const sseClients = new Set<ServerResponse>()
  const sourceDirty = options.sourceDirty ?? false

  presence.subscribe((snapshot) => {
    const frame = `event: presence\ndata: ${JSON.stringify(snapshot)}\n\n`
    for (const client of sseClients) client.write(frame)
  })

  const withAvailability = (node: CodeNodeRecord) => ({
    ...node,
    available: presence.hasModule(node.id),
  })

  function corsHeaders(request: IncomingMessage): Record<string, string> {
    const origin = request.headers.origin
    if (origin === undefined || origin === `http://${request.headers.host}`) return {}
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
      vary: 'origin',
    }
  }

  // Loopback binding does not stop other web pages in the same browser from
  // calling the API, so the Host and Origin headers are checked as well.
  function guard(request: IncomingMessage): void {
    const hostname = hostnameOf(request.headers.host)
    if (hostname === null || !LOOPBACK_HOSTS.has(hostname)) {
      throw new HttpError(403, 'Unexpected Host header')
    }
    const origin = request.headers.origin
    if (origin !== undefined && origin !== `http://${request.headers.host}`) {
      if (!allowedOrigins.has(origin)) throw new HttpError(403, 'Origin is not allowed')
    }
  }

  function openEventStream(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      ...corsHeaders(request),
    })
    response.write(`event: presence\ndata: ${JSON.stringify(presence.snapshot())}\n\n`)
    sseClients.add(response)
    const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), HEARTBEAT_MS)
    heartbeat.unref()
    response.on('close', () => {
      clearInterval(heartbeat)
      sseClients.delete(response)
    })
  }

  async function handle(
    request: IncomingMessage,
    url: URL,
  ): Promise<{ status: number; body: unknown }> {
    const method = request.method ?? 'GET'
    const segments = url.pathname.slice(API.length).split('/').filter(Boolean)
    const [resource, id, sub] = segments
    const ok = (body: unknown) => ({ status: 200, body })

    if (method === 'GET') {
      if (resource === 'health' && segments.length === 1) {
        const problems = archive.verify()
        return ok({ ok: problems.length === 0, problems })
      }
      if (resource === 'presence' && segments.length === 1) return ok(presence.snapshot())
      if (resource === 'code-nodes') {
        if (id === undefined) {
          const role = url.searchParams.get('role')
          if (role !== null && role !== 'seed' && role !== 'mutation') {
            throw new HttpError(400, 'role must be "seed" or "mutation"')
          }
          return ok(archive.listCodeNodes(role ?? undefined).map(withAvailability))
        }
        if (sub === undefined) return ok(withAvailability(archive.getCodeNode(id)))
        if (sub === 'ancestry' && segments.length === 3) {
          return ok(archive.getCodeAncestry(id).map(withAvailability))
        }
      }
      if (resource === 'imprints') {
        if (id === undefined) {
          return ok(archive.listImprints(url.searchParams.get('codeId') ?? undefined))
        }
        if (sub === undefined) return ok(archive.getImprint(id))
        if (sub === 'ancestry' && segments.length === 3) return ok(archive.getImprintAncestry(id))
      }
    }

    if (method === 'POST' && resource === 'presence' && segments.length === 1) {
      const body = await readJsonObject(request)
      const kind = requireString(body, 'kind')
      if (kind !== 'code' && kind !== 'imprint') {
        throw new HttpError(400, 'kind must be "code" or "imprint"')
      }
      return ok(presence.select(kind as SelectKind, requireString(body, 'id')))
    }

    if (
      method === 'PUT' &&
      resource === 'presence' &&
      id === 'parameters' &&
      segments.length === 2
    ) {
      const body = await readJsonObject(request)
      const values = body.parameters
      if (typeof values !== 'object' || values === null || Array.isArray(values)) {
        throw new HttpError(400, '"parameters" must be an object')
      }
      return ok(presence.setParameters(values as Record<string, unknown>))
    }

    if (method === 'POST' && resource === 'imprints' && segments.length === 1) {
      const body = await readJsonObject(request)
      const parentId = body.parentId === null ? null : optionalString(body, 'parentId')
      const imprint = presence.saveImprint({
        sourceRevision: options.sourceRevision,
        sourceDirty,
        parentId,
        randomSeed: optionalInteger(body, 'randomSeed'),
      })
      return { status: 201, body: imprint }
    }

    if (
      method === 'DELETE' &&
      resource === 'imprints' &&
      id !== undefined &&
      segments.length === 2
    ) {
      archive.deleteImprint(id)
      return ok({ id })
    }

    const known = ['health', 'presence', 'code-nodes', 'imprints']
    if (known.includes(resource ?? '')) throw new HttpError(405, 'Method not allowed')
    throw new HttpError(404, 'Not found')
  }

  const server: Server = createServer((request, response) => {
    void (async () => {
      try {
        guard(request)
        const url = new URL(request.url ?? '/', 'http://localhost')
        const method = request.method ?? 'GET'

        if (url.pathname !== API && !url.pathname.startsWith(`${API}/`)) {
          throw new HttpError(404, 'Not found')
        }
        if (method === 'OPTIONS') {
          response.writeHead(204, corsHeaders(request))
          response.end()
          return
        }
        if (method === 'GET' && url.pathname === `${API}/presence/events`) {
          openEventStream(request, response)
          return
        }

        const { status, body } = await handle(request, url)
        sendJson(response, status, body, corsHeaders(request))
      } catch (error) {
        const failure = toHttpError(error)
        if (failure.status === 500) console.error(error)
        if (!response.headersSent) {
          sendJson(response, failure.status, { error: failure.message }, corsHeaders(request))
        }
      }
    })()
  })

  return {
    presence,
    start: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(options.port ?? 4317, host, () => {
          server.off('error', reject)
          const { port } = server.address() as AddressInfo
          const display = host === '::1' ? '[::1]' : host
          resolve({ host, port, url: `http://${display}:${port}` })
        })
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        for (const client of sseClients) client.end()
        server.closeAllConnections()
      }),
  }
}
