import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Archive, CodeNodeRecord } from '../archive'
import {
  isLocalInstallationAddress,
  isLoopbackHost,
  isPrivateNetworkAddress,
  LOOPBACK_HOSTS,
} from './network'
import { PairingPin } from './pairing'
import { PreviewStore, readPreviewUpload, type PreviewAsset, type PreviewKind } from '../previews'
import { serveStaticFile } from './static'
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
import { isPlaybackSpeed } from '../../src/playbackClock'

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
  remoteAccessToken?: string
  staticDirectory?: string
  previewDirectory?: string
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
  const remoteEnabled = !isLoopbackHost(host)
  if (remoteEnabled && !isPrivateNetworkAddress(host)) {
    throw new Error(`Remote access must bind to a private IP address; refusing host ${host}`)
  }
  if (remoteEnabled && options.remoteAccessToken === undefined) {
    throw new Error('Remote access requires PHYSIS_REMOTE_TOKEN')
  }
  if (remoteEnabled && options.staticDirectory === undefined) {
    throw new Error('Remote access requires a built frontend bundle')
  }
  if (
    options.remoteAccessToken !== undefined &&
    !/^[\da-f]{64}$/i.test(options.remoteAccessToken)
  ) {
    throw new Error('The remote access token must be 64 hexadecimal characters')
  }

  const archive = options.archive
  const previewStore =
    options.previewDirectory === undefined ? null : new PreviewStore(options.previewDirectory)
  const presence = new LivePresence(archive, options.modules)
  const allowedOrigins = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS)
  const sseClients = new Set<ServerResponse>()
  const sourceDirty = options.sourceDirty ?? false
  const pairingPin =
    options.remoteAccessToken === undefined ? null : new PairingPin(options.remoteAccessToken)

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
    if (!allowedOrigins.has(origin)) return {}
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      vary: 'origin',
    }
  }

  function guard(request: IncomingMessage): void {
    const hostname = hostnameOf(request.headers.host)
    if (
      hostname === null ||
      (remoteEnabled
        ? hostname.toLowerCase() !== host.toLowerCase()
        : !LOOPBACK_HOSTS.has(hostname))
    ) {
      throw new HttpError(403, 'Unexpected Host header')
    }
    const origin = request.headers.origin
    if (origin !== undefined && origin !== `http://${request.headers.host}`) {
      if (!allowedOrigins.has(origin)) throw new HttpError(403, 'Origin is not allowed')
    }
  }

  function authenticate(request: IncomingMessage): void {
    if (
      options.remoteAccessToken === undefined ||
      (remoteEnabled && isLocalInstallationRequest(request))
    ) {
      return
    }
    const token = request.headers.authorization?.match(/^Bearer ([\da-f]{64})$/i)?.[1]
    const expected = Buffer.from(options.remoteAccessToken, 'hex')
    const supplied = token === undefined ? null : Buffer.from(token, 'hex')
    if (supplied === null || !timingSafeEqual(supplied, expected)) {
      throw new HttpError(401, 'A valid installation token is required')
    }
  }

  function isLocalInstallationRequest(request: IncomingMessage): boolean {
    return isLocalInstallationAddress(host, request.socket.remoteAddress)
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
      if (resource === 'pairing' && id === 'status' && segments.length === 2) {
        return ok(isLocalInstallationRequest(request) ? (pairingPin?.current() ?? null) : null)
      }
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

    if (method === 'POST' && resource === 'pairing' && id === 'request' && segments.length === 2) {
      if (pairingPin === null) throw new HttpError(404, 'Remote pairing is not enabled')
      return { status: 202, body: pairingPin.request() }
    }

    if (method === 'POST' && resource === 'pairing' && id === 'complete' && segments.length === 2) {
      if (pairingPin === null) throw new HttpError(404, 'Remote pairing is not enabled')
      const body = await readJsonObject(request)
      return ok({ token: pairingPin.complete(requireString(body, 'pin')) })
    }

    if (method === 'POST' && resource === 'pairing' && id === 'dismiss' && segments.length === 2) {
      if (!isLocalInstallationRequest(request)) {
        throw new HttpError(403, 'Only the installation display can dismiss the pairing code')
      }
      pairingPin?.dismiss()
      return ok({ dismissed: true })
    }

    if (method === 'POST' && resource === 'presence' && segments.length === 1) {
      const body = await readJsonObject(request)
      const kind = requireString(body, 'kind')
      if (kind !== 'code' && kind !== 'imprint') {
        throw new HttpError(400, 'kind must be "code" or "imprint"')
      }
      return ok(presence.select(kind as SelectKind, requireString(body, 'id')))
    }

    if (method === 'PUT' && resource === 'presence' && id === 'genes' && segments.length === 2) {
      const body = await readJsonObject(request)
      const values = body.genes
      if (typeof values !== 'object' || values === null || Array.isArray(values)) {
        throw new HttpError(400, '"genes" must be an object')
      }
      return ok(presence.setGenes(values as Record<string, unknown>))
    }

    if (method === 'PUT' && resource === 'presence' && id === 'playback' && segments.length === 2) {
      const body = await readJsonObject(request)
      if (Object.hasOwn(body, 'paused') && !Object.hasOwn(body, 'speed')) {
        if (typeof body.paused !== 'boolean') {
          throw new HttpError(400, '"paused" must be a boolean')
        }
        return ok(presence.setPaused(body.paused))
      }
      if (Object.hasOwn(body, 'speed') && !Object.hasOwn(body, 'paused')) {
        if (!isPlaybackSpeed(body.speed)) {
          throw new HttpError(400, '"speed" must be between 0.1 and 4')
        }
        return ok(presence.setSpeed(body.speed))
      }
      throw new HttpError(400, 'Provide exactly one of "paused" or "speed"')
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
      if (previewStore !== null) {
        try {
          await previewStore.remove('imprint', id)
        } catch (error) {
          console.error(`Could not remove preview for deleted Imprint ${id}`, error)
        }
      }
      return ok({ id })
    }

    const known = ['health', 'pairing', 'presence', 'code-nodes', 'imprints']
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
          if (options.staticDirectory !== undefined && (method === 'GET' || method === 'HEAD')) {
            const served = await serveStaticFile(request, response, options.staticDirectory)
            if (served) return
          }
          throw new HttpError(404, 'Not found')
        }
        if (method === 'OPTIONS') {
          response.writeHead(204, corsHeaders(request))
          response.end()
          return
        }
        const pairingEndpoint =
          url.pathname === `${API}/pairing/status` ||
          url.pathname === `${API}/pairing/request` ||
          url.pathname === `${API}/pairing/complete` ||
          url.pathname === `${API}/pairing/dismiss`
        if (!pairingEndpoint) authenticate(request)
        if (method === 'GET' && url.pathname === `${API}/presence/events`) {
          openEventStream(request, response)
          return
        }
        if ((method === 'GET' || method === 'PUT') && url.pathname.startsWith(`${API}/previews/`)) {
          const segments = url.pathname.slice(API.length).split('/').filter(Boolean)
          const [resource, kindValue, id, assetValue] = segments
          if (
            resource !== 'previews' ||
            segments.length !== 4 ||
            id === undefined ||
            (assetValue !== 'poster' && assetValue !== 'animation')
          ) {
            throw new HttpError(404, 'Not found')
          }
          if (previewStore === null) throw new HttpError(503, 'Preview storage is unavailable')
          if (kindValue !== 'code' && kindValue !== 'imprint') {
            throw new HttpError(404, 'Not found')
          }
          const kind: PreviewKind = kindValue
          const asset: PreviewAsset = assetValue
          if (kind === 'code') archive.getCodeNode(id)
          else archive.getImprint(id)

          if (method === 'GET') {
            const preview = await previewStore.get(kind, id, asset)
            if (preview === null) {
              response.writeHead(204, {
                'cache-control': 'private, no-store',
                ...corsHeaders(request),
              })
              response.end()
              return
            }
            response.writeHead(200, {
              'content-type': preview.contentType,
              'content-length': preview.bytes.length,
              'cache-control': 'private, no-store',
              ...corsHeaders(request),
            })
            response.end(preview.bytes)
            return
          }

          await previewStore.put(kind, id, asset, await readPreviewUpload(request, asset))
          response.writeHead(204, corsHeaders(request))
          response.end()
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
