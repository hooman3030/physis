import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { driftingFilamentsSeed } from '../../../src/seeds/p5/drifting-filaments/seed'
import { firstLightSeed } from '../../../src/seeds/p5/first-light/seed'
import { openArchive, type Archive } from '../../../server/archive'
import { registerBundledSeeds } from '../../../server/bootstrap'
import { createControlServer, type ControlServer } from '../../../server/api'

const REVISION = 'a1b2c3d4e5f6'
const REMOTE_TOKEN = 'a'.repeat(64)
const modules = [driftingFilamentsSeed, firstLightSeed]
const seedId = driftingFilamentsSeed.id
const [firstParameter] = driftingFilamentsSeed.parameters

let directory: string
let archive: Archive
let server: ControlServer
let base: string

async function boot(
  options: {
    allowedOrigins?: string[]
    remoteAccessToken?: string
    staticDirectory?: string
  } = {},
) {
  archive = openArchive({ path: join(directory, 'archive.sqlite'), modules })
  registerBundledSeeds(archive, modules, REVISION)
  server = createControlServer({
    archive,
    modules,
    sourceRevision: REVISION,
    port: 0,
    ...options,
  })
  base = (await server.start()).url
}

async function shutdown() {
  await server.stop()
  archive.close()
}

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'physis-api-'))
  await boot()
})

afterEach(async () => {
  await shutdown()
  rmSync(directory, { recursive: true, force: true })
})

async function call(method: string, path: string, body?: unknown, headers: HeadersInit = {}) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as any, response }
}

describe('presence', () => {
  it('starts empty, then selecting a seed starts it at default parameters', async () => {
    expect((await call('GET', '/presence')).body).toMatchObject({ code: null, parameters: null })

    const { status, body } = await call('POST', '/presence', { kind: 'code', id: seedId })
    expect(status).toBe(200)
    expect(body.code.id).toBe(seedId)
    expect(body.imprint).toBeNull()
    expect(body.parameters[firstParameter.id]).toBe(firstParameter.defaultValue)
    expect(body.module.runtime).toBe('p5')
    expect(body.module.parameters).toHaveLength(driftingFilamentsSeed.parameters.length)
  })

  it('live parameter changes are kept in memory and never archived', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const changed = await call('PUT', '/presence/parameters', {
      parameters: { [firstParameter.id]: firstParameter.max },
    })

    expect(changed.body.parameters[firstParameter.id]).toBe(firstParameter.max)
    expect((await call('GET', '/imprints')).body).toEqual([])
  })

  it('rejects unknown, non-numeric, and out-of-bounds parameters', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const put = (parameters: unknown) => call('PUT', '/presence/parameters', { parameters })

    expect((await put({ bogus: 1 })).status).toBe(400)
    expect((await put({ [firstParameter.id]: 'big' })).status).toBe(400)
    expect((await put({ [firstParameter.id]: firstParameter.max + 1 })).status).toBe(400)
    expect((await put([])).status).toBe(400)
  })

  it('refuses parameter changes and saves before anything is selected', async () => {
    expect((await call('PUT', '/presence/parameters', { parameters: {} })).status).toBe(409)
    expect((await call('POST', '/imprints', {})).status).toBe(409)
  })

  it('selects an imprint, restoring its saved parameters', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    await call('PUT', '/presence/parameters', {
      parameters: { [firstParameter.id]: firstParameter.max },
    })
    const saved = await call('POST', '/imprints', {})
    await call('POST', '/presence', { kind: 'code', id: firstLightSeed.id })

    const { body } = await call('POST', '/presence', { kind: 'imprint', id: saved.body.id })
    expect(body.code.id).toBe(seedId)
    expect(body.imprint.id).toBe(saved.body.id)
    expect(body.parameters[firstParameter.id]).toBe(firstParameter.max)
  })

  it('validates selection requests', async () => {
    expect((await call('POST', '/presence', { kind: 'nope', id: seedId })).status).toBe(400)
    expect((await call('POST', '/presence', { kind: 'code' })).status).toBe(400)
    expect((await call('POST', '/presence', { kind: 'code', id: 'unknown' })).status).toBe(400)
    expect((await call('POST', '/presence', { kind: 'imprint', id: 'missing' })).status).toBe(404)
  })

  it('does not select archived code that this build cannot run', async () => {
    archive.recordMutation({ id: 'ghost', parentId: seedId, sourceRevision: REVISION })
    const { status } = await call('POST', '/presence', { kind: 'code', id: 'ghost' })
    expect(status).toBe(400)

    const nodes = await call('GET', '/code-nodes?role=mutation')
    expect(nodes.body).toMatchObject([{ id: 'ghost', available: false }])
  })
})

describe('imprints and lineage', () => {
  it('saves live parameters as a child imprint with the server source revision', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const first = await call('POST', '/imprints', { randomSeed: 7 })
    await call('PUT', '/presence/parameters', {
      parameters: { [firstParameter.id]: firstParameter.min },
    })
    const second = await call('POST', '/imprints', {})

    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({
      codeId: seedId,
      sourceRevision: REVISION,
      randomSeed: 7,
      parentId: null,
      validation: { sourceDirty: false },
    })
    expect(second.body.parentId).toBe(first.body.id)
    expect(
      (await call('GET', `/imprints/${second.body.id}/ancestry`)).body.map((i: any) => i.id),
    ).toEqual([first.body.id, second.body.id])
    expect((await call('GET', `/imprints?codeId=${seedId}`)).body).toHaveLength(2)
    expect((await call('GET', '/presence')).body.imprint.id).toBe(second.body.id)
  })

  it('branches from an explicit parent', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const root = await call('POST', '/imprints', {})
    await call('POST', '/imprints', {})
    const branch = await call('POST', '/imprints', { parentId: root.body.id })
    expect(branch.body.parentId).toBe(root.body.id)
    expect((await call('POST', '/imprints', { parentId: 'missing' })).status).toBe(404)
  })

  it('deletes inactive Imprints and reparents descendants while protecting the active Imprint', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const root = await call('POST', '/imprints', {})
    const deleted = await call('POST', '/imprints', {})
    const child = await call('POST', '/imprints', {})
    const branch = await call('POST', '/imprints', { parentId: deleted.body.id })

    expect((await call('DELETE', `/imprints/${branch.body.id}`)).status).toBe(409)

    const removal = await call('DELETE', `/imprints/${deleted.body.id}`)
    expect(removal).toMatchObject({ status: 200, body: { id: deleted.body.id } })
    expect((await call('GET', `/imprints/${deleted.body.id}`)).status).toBe(404)
    expect((await call('GET', `/imprints/${child.body.id}`)).body.parentId).toBe(root.body.id)
    expect((await call('GET', `/imprints/${branch.body.id}`)).body.parentId).toBe(root.body.id)
    expect(
      (await call('GET', `/imprints/${child.body.id}/ancestry`)).body.map((i: any) => i.id),
    ).toEqual([root.body.id, child.body.id])
    expect((await call('DELETE', '/imprints/missing')).status).toBe(404)
  })

  it('lists and reads code nodes with availability', async () => {
    const seeds = await call('GET', '/code-nodes?role=seed')
    expect(seeds.body.map((node: any) => node.id).sort()).toEqual(
      [firstLightSeed.id, seedId].sort(),
    )
    expect(seeds.body.every((node: any) => node.available)).toBe(true)
    expect((await call('GET', `/code-nodes/${seedId}`)).body.role).toBe('seed')
    expect((await call('GET', `/code-nodes/${seedId}/ancestry`)).body).toHaveLength(1)
    expect((await call('GET', '/code-nodes?role=other')).status).toBe(400)
    expect((await call('GET', '/code-nodes/missing')).status).toBe(404)
  })
})

describe('persistence across restart', () => {
  it('restores the selected imprint and its parameters, but not unsaved tweaks', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    await call('PUT', '/presence/parameters', {
      parameters: { [firstParameter.id]: firstParameter.max },
    })
    const saved = await call('POST', '/imprints', {})
    await call('PUT', '/presence/parameters', {
      parameters: { [firstParameter.id]: firstParameter.min },
    })

    await shutdown()
    await boot()

    const { body } = await call('GET', '/presence')
    expect(body.imprint.id).toBe(saved.body.id)
    expect(body.parameters[firstParameter.id]).toBe(firstParameter.max)
  })

  it('starts empty when the stored code is not part of this build', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    await shutdown()

    archive = openArchive({ path: join(directory, 'archive.sqlite'), modules })
    server = createControlServer({
      archive,
      modules: [firstLightSeed],
      sourceRevision: REVISION,
      port: 0,
    })
    base = (await server.start()).url

    expect((await call('GET', '/presence')).body).toMatchObject({ code: null, parameters: null })
  })
})

describe('health and routing errors', () => {
  it('reports archive health', async () => {
    expect((await call('GET', '/health')).body).toEqual({ ok: true, problems: [] })
  })

  it('returns JSON errors for unknown routes, methods, and bad bodies', async () => {
    expect((await call('GET', '/nowhere')).status).toBe(404)
    expect((await call('DELETE', '/presence')).status).toBe(405)

    const notJson = await fetch(`${base}/api/v1/presence`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    })
    expect(notJson.status).toBe(415)

    const broken = await fetch(`${base}/api/v1/presence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{nope',
    })
    expect(broken.status).toBe(400)

    const tooLarge = await fetch(`${base}/api/v1/presence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pad: 'x'.repeat(70_000) }),
    })
    expect(tooLarge.status).toBe(413)
  })
})

describe('network boundary', () => {
  it('binds to loopback and refuses other hosts', () => {
    expect(() =>
      createControlServer({ archive, modules, sourceRevision: REVISION, host: '0.0.0.0' }),
    ).toThrow(/private IP/)
    expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('requires a token and built bundle before binding to a private address', () => {
    expect(() =>
      createControlServer({
        archive,
        modules,
        sourceRevision: REVISION,
        host: '192.168.1.42',
        staticDirectory: directory,
      }),
    ).toThrow(/PHYSIS_REMOTE_TOKEN/)
    expect(() =>
      createControlServer({
        archive,
        modules,
        sourceRevision: REVISION,
        host: '192.168.1.42',
        remoteAccessToken: REMOTE_TOKEN,
      }),
    ).toThrow(/built frontend bundle/)
    expect(() =>
      createControlServer({
        archive,
        modules,
        sourceRevision: REVISION,
        host: '203.0.113.42',
        remoteAccessToken: REMOTE_TOKEN,
        staticDirectory: directory,
      }),
    ).toThrow(/private IP/)
    expect(() =>
      createControlServer({
        archive,
        modules,
        sourceRevision: REVISION,
        host: '192.168.1.42',
        remoteAccessToken: 'not-a-token',
        staticDirectory: directory,
      }),
    ).toThrow(/64 hexadecimal characters/)
    expect(() =>
      createControlServer({
        archive,
        modules,
        sourceRevision: REVISION,
        host: '192.168.1.42',
        remoteAccessToken: REMOTE_TOKEN,
        staticDirectory: directory,
      }),
    ).not.toThrow()
  })

  it('authenticates every API route in token mode and allows authenticated preflight', async () => {
    await shutdown()
    writeFileSync(join(directory, 'index.html'), '<main>Physis</main>')
    await boot({
      allowedOrigins: ['http://127.0.0.1:5173'],
      remoteAccessToken: REMOTE_TOKEN,
      staticDirectory: directory,
    })

    const dashboard = await fetch(base, { headers: { accept: 'text/html' } })
    expect(dashboard.status).toBe(200)
    expect((await call('GET', '/presence')).status).toBe(401)
    expect((await call('GET', '/health')).status).toBe(401)
    expect((await call('GET', '/imprints')).status).toBe(401)
    expect((await call('GET', '/presence/events')).status).toBe(401)
    expect(
      (
        await call('GET', '/presence', undefined, {
          authorization: `Bearer ${'b'.repeat(64)}`,
        })
      ).status,
    ).toBe(401)
    expect(
      (await call('GET', '/presence', undefined, { authorization: `Bearer ${REMOTE_TOKEN}` }))
        .status,
    ).toBe(200)

    const preflight = await fetch(`${base}/api/v1/presence`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization')
  })

  it('pairs a browser through an on-demand PIN without exposing that PIN remotely', async () => {
    await shutdown()
    await boot({ remoteAccessToken: REMOTE_TOKEN })

    const request = await call('POST', '/pairing/request')
    expect(request.status).toBe(202)
    expect(request.body).toMatchObject({ expiresAt: expect.any(Number) })

    const installationDisplay = await call('GET', '/pairing/status')
    expect(installationDisplay.body.pin).toMatch(/^\d{6}$/)
    const wrongPin = installationDisplay.body.pin === '000000' ? '000001' : '000000'
    expect((await call('POST', '/pairing/complete', { pin: wrongPin })).status).toBe(401)

    const paired = await call('POST', '/pairing/complete', {
      pin: installationDisplay.body.pin,
    })
    expect(paired).toMatchObject({ status: 200, body: { token: REMOTE_TOKEN } })
    expect((await call('GET', '/pairing/status')).body).toBeNull()
    expect((await call('GET', '/presence')).status).toBe(401)
    expect(
      (
        await call('GET', '/presence', undefined, {
          authorization: `Bearer ${REMOTE_TOKEN}`,
        })
      ).status,
    ).toBe(200)
  })

  it('rejects foreign origins but allows configured and same-origin callers', async () => {
    const foreign = await call('GET', '/presence', undefined, { origin: 'https://evil.example' })
    expect(foreign.status).toBe(403)

    const sameOrigin = await call('GET', '/presence', undefined, { origin: base })
    expect(sameOrigin.status).toBe(200)

    await shutdown()
    await boot({ allowedOrigins: ['http://127.0.0.1:5173'] })
    const allowed = await call('GET', '/presence', undefined, { origin: 'http://127.0.0.1:5173' })
    expect(allowed.status).toBe(200)
    expect(allowed.response.headers.get('access-control-allow-origin')).toBe(
      'http://127.0.0.1:5173',
    )

    const preflight = await fetch(`${base}/api/v1/imprints/example`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'DELETE',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-methods')).toContain('DELETE')
  })

  it('rejects an unexpected Host header (DNS rebinding)', async () => {
    const { port } = new URL(base)
    const status = await new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest(
        { host: '127.0.0.1', port, path: '/api/v1/presence', headers: { host: 'evil.example' } },
        (response) => {
          response.resume()
          resolve(response.statusCode ?? 0)
        },
      )
      outgoing.on('error', reject)
      outgoing.end()
    })
    expect(status).toBe(403)
  })
})

describe('static dashboard', () => {
  it('serves the built app and falls back to its entrypoint for browser routes', async () => {
    await shutdown()
    mkdirSync(join(directory, 'assets'))
    writeFileSync(join(directory, 'index.html'), '<main>Physis</main>')
    writeFileSync(join(directory, 'assets', 'app.js'), 'console.log("ok")')
    await boot({ staticDirectory: directory })

    const page = await fetch(base, { headers: { accept: 'text/html' } })
    expect(page.status).toBe(200)
    expect(await page.text()).toBe('<main>Physis</main>')

    const route = await fetch(`${base}/studio`, { headers: { accept: 'text/html' } })
    expect(route.status).toBe(200)
    expect(await route.text()).toBe('<main>Physis</main>')

    const asset = await fetch(`${base}/assets/app.js`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('content-type')).toContain('text/javascript')
    expect(await asset.text()).toBe('console.log("ok")')

    const missingAsset = await fetch(`${base}/assets/missing.js`)
    expect(missingAsset.status).toBe(404)
  })
})

describe('presence events (SSE)', () => {
  it('sends the current state, then every change', async () => {
    const controller = new AbortController()
    const response = await fetch(`${base}/api/v1/presence/events`, { signal: controller.signal })
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const nextEvent = async () => {
      while (!buffer.includes('\n\n')) {
        const { value, done } = await reader.read()
        if (done) throw new Error('stream ended')
        buffer += decoder.decode(value)
      }
      const end = buffer.indexOf('\n\n')
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      expect(frame.startsWith('event: presence\ndata: ')).toBe(true)
      return JSON.parse(frame.slice('event: presence\ndata: '.length))
    }

    expect((await nextEvent()).code).toBeNull()

    await call('POST', '/presence', { kind: 'code', id: seedId })
    const selected = await nextEvent()
    expect(selected.code.id).toBe(seedId)

    await call('PUT', '/presence/parameters', {
      parameters: { [firstParameter.id]: firstParameter.max },
    })
    const tweaked = await nextEvent()
    expect(tweaked.parameters[firstParameter.id]).toBe(firstParameter.max)
    expect(tweaked.revision).toBeGreaterThan(selected.revision)

    controller.abort()
  })
})
