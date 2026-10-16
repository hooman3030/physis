import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ControlApiError,
  completePairing,
  createImprint,
  deleteImprint,
  dismissPairingPin,
  getControlApiToken,
  getLineagePreview,
  getPairingStatus,
  getPresence,
  listCodeNodes,
  listImprints,
  requestPairingPin,
  saveControlApiToken,
  saveLineagePreview,
  selectCode,
  selectImprint,
  setGenes,
  setPresenceAura,
  setPresenceToneMapping,
  setPresencePaused,
  setPresenceSpeed,
  subscribeToPresence,
} from '../../src/controlClient'

const snapshot = {
  revision: 3,
  paused: false,
  speed: 1,
  auraId: null,
  toneMappingId: null,
  code: { id: 'first-light' },
  imprint: null,
  module: { id: 'first-light', label: 'First Light', genes: [], runtime: 'p5' },
  genes: {},
}

const imprint = {
  id: 'imprint-1',
  parentId: null,
  codeId: 'first-light',
  sourceRevision: '0123456789abcdef',
  createdAt: '2026-10-14T11:00:00.000Z',
  genes: { glow: 0.75 },
  auraId: null,
  toneMappingId: null,
}

const codeNode = {
  id: 'first-light',
  parentId: null,
  role: 'seed',
  sourceRevision: '0123456789abcdef',
  promotedAt: '2026-10-14T11:00:00.000Z',
  createdAt: '2026-10-14T11:00:00.000Z',
  available: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('control API client', () => {
  it('requests a PIN, checks the installation display, and completes pairing', async () => {
    const token = 'a'.repeat(64)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ expiresAt: 301_000 }), { status: 202 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ pin: '012345', expiresAt: 301_000 }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ token }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dismissed: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestPairingPin()).resolves.toBe(301_000)
    await expect(getPairingStatus()).resolves.toEqual({
      pin: '012345',
      expiresAt: 301_000,
    })
    await expect(completePairing('012345')).resolves.toBe(token)
    await expect(dismissPairingPin()).resolves.toBeUndefined()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/pairing/request',
      '/api/v1/pairing/status',
      '/api/v1/pairing/complete',
      '/api/v1/pairing/dismiss',
    ])
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ pin: '012345' }))
  })

  it('loads and validates the current Presence', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPresence()).resolves.toEqual(snapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept')).toBe(
      'application/json',
    )
  })

  it('sets shared Presence playback state and validates the returned snapshot', async () => {
    const pausedSnapshot = { ...snapshot, paused: true }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(pausedSnapshot), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setPresencePaused(true)).resolves.toEqual(pausedSnapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence/playback',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ paused: true }),
        headers: expect.any(Headers),
      }),
    )
  })

  it('sets and validates the shared Presence speed', async () => {
    const fasterSnapshot = { ...snapshot, speed: 2.5 }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(fasterSnapshot), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setPresenceSpeed(2.5)).resolves.toEqual(fasterSnapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence/playback',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ speed: 2.5 }),
        headers: expect.any(Headers),
      }),
    )
  })

  it('sets and validates a compatible shared Presence Aura', async () => {
    const threeSnapshot = {
      ...snapshot,
      auraId: 'warm-film',
      code: { id: 'first-orbit' },
      module: {
        id: 'first-orbit',
        label: 'First Orbit',
        genes: [],
        runtime: 'three',
        defaultAuraId: 'soft-bloom',
      },
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(threeSnapshot), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setPresenceAura('warm-film')).resolves.toEqual(threeSnapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence/aura',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ auraId: 'warm-film' }),
        headers: expect.any(Headers),
      }),
    )
  })

  it('sets and validates compatible shared Presence tone mapping', async () => {
    const threeSnapshot = {
      ...snapshot,
      toneMappingId: 'agx',
      code: { id: 'first-orbit' },
      module: {
        id: 'first-orbit',
        label: 'First Orbit',
        genes: [],
        runtime: 'three',
        defaultAuraId: 'soft-bloom',
      },
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(threeSnapshot), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setPresenceToneMapping('agx')).resolves.toEqual(threeSnapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence/tone-mapping',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ toneMappingId: 'agx' }),
        headers: expect.any(Headers),
      }),
    )
  })

  it('reports the HTTP status when the API proxy returns non-JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('<html>Bad Gateway</html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'content-type': 'text/html' },
        }),
      ),
    )

    await expect(getPresence()).rejects.toMatchObject({
      name: 'ControlApiError',
      status: 502,
      message: 'Control API returned HTTP 502 Bad Gateway with a non-JSON response',
    })
  })

  it('stores the installation token and sends it in the Authorization header', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const token = 'a'.repeat(64)

    saveControlApiToken(token)
    expect(getControlApiToken()).toBe(token)
    await getPresence()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      `Bearer ${token}`,
    )
  })

  it('loads and saves authenticated lineage previews while treating missing previews as normal', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(new Blob(['poster'], { type: 'image/webp' }), {
          status: 200,
          headers: { 'content-type': 'image/webp' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    saveControlApiToken('b'.repeat(64))
    expect(getControlApiToken()).toBe('b'.repeat(64))

    const preview = await getLineagePreview('imprint', 'imprint-1')
    expect(preview?.type).toBe('image/webp')
    await saveLineagePreview('imprint', 'imprint-1', new Blob(['poster'], { type: 'image/webp' }))
    await expect(getLineagePreview('code', 'seed-1')).resolves.toBeNull()

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/previews/imprint/imprint-1/poster',
      '/api/v1/previews/imprint/imprint-1/poster',
      '/api/v1/previews/code/seed-1/poster',
    ])
    expect(
      fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).has('authorization')),
    ).toEqual([true, true, true])
    const authorization = new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('authorization')
    expect(authorization?.slice(0, 6)).toBe('Bearer')
    expect(authorization?.length).toBe(71)
    expect(authorization?.endsWith('b'.repeat(64))).toBe(true)
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT')
  })

  it('loads and saves authenticated GIF animation assets', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(new Blob(['gif'], { type: 'image/gif' }), {
            status: 200,
            headers: { 'content-type': 'image/gif' },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    )

    const animation = await getLineagePreview('code', 'seed-1', 'animation')
    expect(animation?.type).toBe('image/gif')
    await saveLineagePreview(
      'code',
      'seed-1',
      new Blob(['gif'], { type: 'image/gif' }),
      'animation',
    )

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/previews/code/seed-1/animation',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/previews/code/seed-1/animation',
      expect.objectContaining({ method: 'PUT', body: expect.any(Blob) }),
    )
  })

  it('rejects malformed installation tokens', () => {
    expect(() => saveControlApiToken('short')).toThrow('64 hexadecimal characters')
  })

  it('rejects Presence modules with an unknown runtime', async () => {
    const invalid = {
      ...snapshot,
      module: { ...snapshot.module, runtime: 'webgpu' },
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(invalid), { status: 200 })),
    )

    await expect(getPresence()).rejects.toThrow('invalid module declaration')
  })

  it('sends module, Gene, and Imprint changes using the API contract', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'POST' && String(_input).endsWith('/imprints')) {
        return new Response(JSON.stringify({ id: 'imprint-1' }), { status: 201 })
      }
      return new Response(JSON.stringify(snapshot), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await selectCode('drifting-filaments')
    await setGenes({ filamentCount: 120 })
    await expect(createImprint()).resolves.toEqual({ id: 'imprint-1' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/presence',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'code', id: 'drifting-filaments' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/presence/genes',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ genes: { filamentCount: 120 } }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/imprints',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    )
  })

  it('lists saved Imprints and selects one through the Presence route', async () => {
    const selected = {
      ...snapshot,
      imprint: { id: imprint.id },
      genes: imprint.genes,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([imprint]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(selected), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listImprints()).resolves.toEqual([imprint])
    await expect(selectImprint(imprint.id)).resolves.toEqual(selected)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/imprints',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/presence',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'imprint', id: imprint.id }),
      }),
    )
  })

  it('lists code nodes with archive roles and build availability', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([codeNode]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listCodeNodes()).resolves.toEqual([codeNode])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/code-nodes',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('rejects code nodes with invalid availability', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify([{ ...codeNode, available: 'yes' }]), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listCodeNodes()).rejects.toThrow('invalid code node')
  })

  it('deletes an Imprint through the archive API', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'imprint-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteImprint('imprint-1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/imprints/imprint-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('surfaces API errors instead of treating them as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: 'No artwork is selected' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    await expect(setGenes({ filamentCount: 120 })).rejects.toEqual(
      new ControlApiError(409, 'No artwork is selected'),
    )
  })

  it('subscribes to authenticated Presence events and closes the stream', async () => {
    const values = new Map<string, string>()
    const token = 'b'.repeat(64)
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    saveControlApiToken(token)
    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
      })
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const onPresence = vi.fn()
    const onOpen = vi.fn()
    const onError = vi.fn()

    const close = subscribeToPresence(onPresence, onOpen, onError)
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledOnce())
    streamController.enqueue(
      new TextEncoder().encode(`event: presence\ndata: ${JSON.stringify(snapshot)}\n\n`),
    )
    await vi.waitFor(() => expect(onPresence).toHaveBeenCalledWith(snapshot))
    close()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/presence/events',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      `Bearer ${token}`,
    )
    expect(onError).not.toHaveBeenCalled()
  })
})
