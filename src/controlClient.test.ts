import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ControlApiError,
  createImprint,
  getPresence,
  listImprints,
  selectCode,
  selectImprint,
  setParameters,
  subscribeToPresence,
} from './controlClient'

const snapshot = {
  revision: 3,
  code: { id: 'first-light' },
  imprint: null,
  module: { id: 'first-light', label: 'First Light', parameters: [] },
  parameters: {},
}

const imprint = {
  id: 'imprint-1',
  parentId: null,
  codeId: 'first-light',
  sourceRevision: '0123456789abcdef',
  createdAt: '2026-10-14T11:00:00.000Z',
  parameters: { glow: 0.75 },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('control API client', () => {
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
      'http://127.0.0.1:4317/api/v1/presence',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    )
  })

  it('sends module, parameter, and Imprint changes using the API contract', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'POST' && String(_input).endsWith('/imprints')) {
        return new Response(JSON.stringify({ id: 'imprint-1' }), { status: 201 })
      }
      return new Response(JSON.stringify(snapshot), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await selectCode('drifting-filaments')
    await setParameters({ filamentCount: 120 })
    await expect(createImprint()).resolves.toEqual({ id: 'imprint-1' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/api/v1/presence',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'code', id: 'drifting-filaments' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/api/v1/presence/parameters',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ parameters: { filamentCount: 120 } }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/api/v1/imprints',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    )
  })

  it('lists saved Imprints and selects one through the Presence route', async () => {
    const selected = {
      ...snapshot,
      imprint: { id: imprint.id },
      parameters: imprint.parameters,
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
      'http://127.0.0.1:4317/api/v1/imprints',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/api/v1/presence',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'imprint', id: imprint.id }),
      }),
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

    await expect(setParameters({ filamentCount: 120 })).rejects.toEqual(
      new ControlApiError(409, 'No artwork is selected'),
    )
  })

  it('subscribes to Presence events and closes the event stream', () => {
    class MockEventSource extends EventTarget {
      static instance: MockEventSource
      onopen: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      readonly url: string
      closed = false

      constructor(url: string) {
        super()
        this.url = url
        MockEventSource.instance = this
      }

      close() {
        this.closed = true
      }
    }
    vi.stubGlobal('EventSource', MockEventSource)
    const onPresence = vi.fn()
    const onOpen = vi.fn()
    const onError = vi.fn()

    const close = subscribeToPresence(onPresence, onOpen, onError)
    const events = MockEventSource.instance
    events.dispatchEvent(new MessageEvent('presence', { data: JSON.stringify(snapshot) }))
    events.onopen?.(new Event('open'))
    close()

    expect(events.url).toBe('http://127.0.0.1:4317/api/v1/presence/events')
    expect(onPresence).toHaveBeenCalledWith(snapshot)
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
    expect(events.closed).toBe(true)
  })
})
