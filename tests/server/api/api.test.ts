import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { driftingFilamentsSeed } from '../../../src/seeds/p5/drifting-filaments/seed'
import { firstLightSeed } from '../../../src/seeds/p5/first-light/seed'
import { firstOrbitSeed } from '../../../src/seeds/three/first-orbit/seed'
import { openArchive, type Archive } from '../../../server/archive'
import { registerBundledSeeds } from '../../../server/bootstrap'
import { createControlServer, type ControlServer } from '../../../server/api'
import { encodePingPongGif } from '../../../src/ui/archive/encodePingPongGif'

const REVISION = 'a1b2c3d4e5f6'
const REMOTE_TOKEN = 'a'.repeat(64)
const modules = [driftingFilamentsSeed, firstLightSeed, firstOrbitSeed]
const seedId = driftingFilamentsSeed.id
const [firstGene] = driftingFilamentsSeed.genes

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
    previewDirectory: join(directory, 'previews'),
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
  it('starts empty, then selecting a seed starts it at default Genes', async () => {
    expect((await call('GET', '/presence')).body).toMatchObject({
      code: null,
      genes: null,
      paused: false,
      speed: 1,
      toneMappingId: null,
    })

    const { status, body } = await call('POST', '/presence', { kind: 'code', id: seedId })
    expect(status).toBe(200)
    expect(body.code.id).toBe(seedId)
    expect(body.imprint).toBeNull()
    expect(body.genes[firstGene.id]).toBe(firstGene.defaultValue)
    expect(body.module.runtime).toBe('p5')
    expect(body.module.genes).toHaveLength(driftingFilamentsSeed.genes.length)
  })

  it('shares a compatible Aura and treats Off as an explicit selection', async () => {
    const selected = await call('POST', '/presence', {
      kind: 'code',
      id: firstOrbitSeed.id,
    })
    expect(selected.body.auraId).toBe('soft-bloom')

    const off = await call('PUT', '/presence/aura', { auraId: 'off' })
    expect(off.status).toBe(200)
    expect(off.body.auraId).toBe('off')
    expect((await call('GET', '/presence')).body.auraId).toBe('off')

    expect((await call('PUT', '/presence/aura', { auraId: 'warm-film' })).body.auraId).toBe(
      'warm-film',
    )
    await call('POST', '/presence', { kind: 'code', id: seedId })
    expect((await call('GET', '/presence')).body.auraId).toBeNull()
    expect((await call('PUT', '/presence/aura', { auraId: 'soft-bloom' })).status).toBe(400)
    expect((await call('PUT', '/presence/aura', { auraId: 'unknown' })).status).toBe(400)
  })

  it('shares compatible Three tone mapping and validates incompatible selections', async () => {
    const selected = await call('POST', '/presence', {
      kind: 'code',
      id: firstOrbitSeed.id,
    })
    expect(selected.body.toneMappingId).toBe('none')

    const mapped = await call('PUT', '/presence/tone-mapping', { toneMappingId: 'agx' })
    expect(mapped.status).toBe(200)
    expect(mapped.body.toneMappingId).toBe('agx')
    expect((await call('GET', '/presence')).body.toneMappingId).toBe('agx')
    expect((await call('PUT', '/presence/tone-mapping', { toneMappingId: 'unknown' })).status).toBe(
      400,
    )
    expect(
      (await call('PUT', '/presence/tone-mapping', { toneMappingId: 'neutral', extra: true }))
        .status,
    ).toBe(400)

    await call('POST', '/presence', { kind: 'code', id: seedId })
    expect((await call('GET', '/presence')).body.toneMappingId).toBeNull()
    expect((await call('PUT', '/presence/tone-mapping', { toneMappingId: 'agx' })).status).toBe(400)
  })

  it('shares transient playback controls and resets them for newly selected artwork', async () => {
    expect((await call('PUT', '/presence/playback', { paused: true })).status).toBe(409)
    await call('POST', '/presence', { kind: 'code', id: seedId })

    const faster = await call('PUT', '/presence/playback', { speed: 2.5 })
    expect(faster.status).toBe(200)
    expect(faster.body.speed).toBe(2.5)
    expect((await call('GET', '/presence')).body.speed).toBe(2.5)
    expect((await call('PUT', '/presence/playback', { speed: 0 })).status).toBe(400)
    expect((await call('PUT', '/presence/playback', { speed: 4.1 })).status).toBe(400)
    expect((await call('PUT', '/presence/playback', { paused: true, speed: 2 })).status).toBe(400)

    const paused = await call('PUT', '/presence/playback', { paused: true })
    expect(paused.status).toBe(200)
    expect(paused.body.paused).toBe(true)
    expect((await call('GET', '/presence')).body.paused).toBe(true)
    expect((await call('PUT', '/presence/playback', { paused: 'true' })).status).toBe(400)

    const revision = paused.body.revision
    expect((await call('PUT', '/presence/playback', { paused: true })).body.revision).toBe(revision)
    const selected = await call('POST', '/presence', { kind: 'code', id: firstLightSeed.id })
    expect(selected.body.paused).toBe(false)
    expect(selected.body.speed).toBe(1)
  })

  it('publishes playback changes through Presence events', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const response = await fetch(`${base}/api/v1/presence/events`)
    const reader = response.body?.getReader()
    expect(reader).toBeDefined()
    const decoder = new TextDecoder()
    const firstEvent = await reader!.read()
    expect(decoder.decode(firstEvent.value)).toContain('"paused":false')

    await call('PUT', '/presence/playback', { paused: true })
    await call('PUT', '/presence/playback', { speed: 2.5 })
    const pauseEvent = await reader!.read()
    expect(decoder.decode(pauseEvent.value)).toContain('"paused":true')
    await reader!.cancel()

    const reconnected = await fetch(`${base}/api/v1/presence/events`)
    const reconnectReader = reconnected.body?.getReader()
    expect(reconnectReader).toBeDefined()
    const initialEvent = await reconnectReader!.read()
    expect(decoder.decode(initialEvent.value)).toContain('"paused":true')
    await reconnectReader!.cancel()
  })

  it('resets transient playback state after a service restart', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    await call('PUT', '/presence/playback', { paused: true })
    await server.stop()

    server = createControlServer({
      archive,
      modules,
      sourceRevision: REVISION,
      port: 0,
      previewDirectory: join(directory, 'previews'),
    })
    base = (await server.start()).url
    expect((await call('GET', '/presence')).body).toMatchObject({ paused: false, speed: 1 })
  })

  it('live Gene changes are kept in memory and never archived', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const changed = await call('PUT', '/presence/genes', {
      genes: { [firstGene.id]: firstGene.max },
    })

    expect(changed.body.genes[firstGene.id]).toBe(firstGene.max)
    expect((await call('GET', '/imprints')).body).toEqual([])
  })

  it('rejects unknown, non-numeric, and out-of-bounds Genes', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const put = (genes: unknown) => call('PUT', '/presence/genes', { genes })

    expect((await put({ bogus: 1 })).status).toBe(400)
    expect((await put({ [firstGene.id]: 'big' })).status).toBe(400)
    expect((await put({ [firstGene.id]: firstGene.max + 1 })).status).toBe(400)
    expect((await put([])).status).toBe(400)
  })

  it('refuses Gene changes and saves before anything is selected', async () => {
    expect((await call('PUT', '/presence/genes', { genes: {} })).status).toBe(409)
    expect((await call('POST', '/imprints', {})).status).toBe(409)
  })

  it('selects an imprint, restoring its saved Genes', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    await call('PUT', '/presence/genes', {
      genes: { [firstGene.id]: firstGene.max },
    })
    const saved = await call('POST', '/imprints', {})
    await call('POST', '/presence', { kind: 'code', id: firstLightSeed.id })

    const { body } = await call('POST', '/presence', { kind: 'imprint', id: saved.body.id })
    expect(body.code.id).toBe(seedId)
    expect(body.imprint.id).toBe(saved.body.id)
    expect(body.genes[firstGene.id]).toBe(firstGene.max)
  })

  it('captures Aura and tone mapping per Imprint and falls back for legacy Imprints', async () => {
    await call('POST', '/presence', { kind: 'code', id: firstOrbitSeed.id })
    await call('PUT', '/presence/aura', { auraId: 'prismatic' })
    await call('PUT', '/presence/tone-mapping', { toneMappingId: 'agx' })
    const saved = await call('POST', '/imprints', {})
    expect(saved.body.auraId).toBe('prismatic')
    expect(saved.body.toneMappingId).toBe('agx')

    await call('POST', '/presence', { kind: 'code', id: firstLightSeed.id })
    const restored = await call('POST', '/presence', {
      kind: 'imprint',
      id: saved.body.id,
    })
    expect(restored.body.auraId).toBe('prismatic')
    expect(restored.body.toneMappingId).toBe('agx')

    const legacy = archive.saveImprint({
      codeId: firstOrbitSeed.id,
      sourceRevision: REVISION,
      genes: Object.fromEntries(
        firstOrbitSeed.genes.map(({ id, defaultValue }) => [id, defaultValue]),
      ),
      auraId: null,
      toneMappingId: null,
    })
    const legacyRestored = await call('POST', '/presence', {
      kind: 'imprint',
      id: legacy.id,
    })
    expect(legacyRestored.body.auraId).toBe(firstOrbitSeed.defaultAuraId)
    expect(legacyRestored.body.toneMappingId).toBe('none')
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
  it('saves live Genes as a child Imprint with the server source revision', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const first = await call('POST', '/imprints', { randomSeed: 7 })
    await call('PUT', '/presence/genes', {
      genes: { [firstGene.id]: firstGene.min },
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
      [firstLightSeed.id, firstOrbitSeed.id, seedId].sort(),
    )
    expect(seeds.body.every((node: any) => node.available)).toBe(true)
    expect((await call('GET', `/code-nodes/${seedId}`)).body.role).toBe('seed')
    expect((await call('GET', `/code-nodes/${seedId}/ancestry`)).body).toHaveLength(1)
    expect((await call('GET', '/code-nodes?role=other')).status).toBe(400)
    expect((await call('GET', '/code-nodes/missing')).status).toBe(404)
  })

  it('stores bounded PNG posters for archived nodes', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const imprint = await call('POST', '/imprints', {})
    const path = `/previews/imprint/${imprint.body.id}/poster`
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+n4p8AAAAASUVORK5CYII=',
      'base64',
    )

    expect((await fetch(`${base}/api/v1${path}`)).status).toBe(204)
    const upload = await fetch(`${base}/api/v1${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: png,
    })
    expect(upload.status).toBe(204)

    const download = await fetch(`${base}/api/v1${path}`)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await download.arrayBuffer())).toEqual(png)
    expect(existsSync(join(directory, 'previews', 'imprint', imprint.body.id, 'poster'))).toBe(true)

    const invalid = await fetch(`${base}/api/v1${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: Buffer.from('not an image'),
    })
    expect(invalid.status).toBe(415)

    const oversized = Buffer.from(png)
    oversized.writeUInt32BE(257, 16)
    const invalidDimensions = await fetch(`${base}/api/v1${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: oversized,
    })
    expect(invalidDimensions.status).toBe(413)

    await call('POST', '/imprints', {})
    expect((await call('DELETE', `/imprints/${imprint.body.id}`)).status).toBe(200)
    expect(existsSync(join(directory, 'previews', 'imprint', imprint.body.id))).toBe(false)
  })

  it('stores validated GIF animations for archived nodes', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    const frameA = new Uint8Array([255, 0, 0, 255])
    const frameB = new Uint8Array([0, 0, 255, 255])
    const animation = encodePingPongGif([frameA, frameB], 1, 1)
    if (animation === null) throw new Error('Test GIF could not be encoded')
    const path = `/previews/code/${seedId}/animation`

    expect(
      (
        await fetch(`${base}/api/v1${path}`, {
          method: 'PUT',
          headers: { 'content-type': 'image/gif' },
          body: Buffer.from(animation),
        })
      ).status,
    ).toBe(204)
    const download = await fetch(`${base}/api/v1${path}`)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe('image/gif')
    expect(Buffer.from(await download.arrayBuffer())).toEqual(Buffer.from(animation))

    const invalid = await fetch(`${base}/api/v1${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/gif' },
      body: Buffer.from('GIF89a'),
    })
    expect(invalid.status).toBe(415)
  })
})

describe('persistence across restart', () => {
  it('restores the selected Imprint and its Genes, but not unsaved tweaks', async () => {
    await call('POST', '/presence', { kind: 'code', id: seedId })
    await call('PUT', '/presence/genes', {
      genes: { [firstGene.id]: firstGene.max },
    })
    const saved = await call('POST', '/imprints', {})
    await call('PUT', '/presence/genes', {
      genes: { [firstGene.id]: firstGene.min },
    })

    await shutdown()
    await boot()

    const { body } = await call('GET', '/presence')
    expect(body.imprint.id).toBe(saved.body.id)
    expect(body.genes[firstGene.id]).toBe(firstGene.max)
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

    expect((await call('GET', '/presence')).body).toMatchObject({ code: null, genes: null })
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
    expect((await call('GET', `/previews/code/${seedId}/poster`)).status).toBe(401)
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

    await call('PUT', '/presence/genes', {
      genes: { [firstGene.id]: firstGene.max },
    })
    const tweaked = await nextEvent()
    expect(tweaked.genes[firstGene.id]).toBe(firstGene.max)
    expect(tweaked.revision).toBeGreaterThan(selected.revision)

    controller.abort()
  })
})
