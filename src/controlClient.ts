import type { ArtworkGene, ArtworkGeneValues, RuntimeKind, SeedDeclaration } from './seeds/types'

const API_BASE_URL = '/api/v1'
const TOKEN_STORAGE_KEY = 'physis:installation-token:v1'

export type PresenceSnapshot = {
  revision: number
  code: { id: string } | null
  imprint: { id: string } | null
  module: SeedDeclaration | null
  genes: ArtworkGeneValues | null
}

export type ImprintRecord = {
  id: string
  parentId: string | null
  codeId: string
  sourceRevision: string
  createdAt: string
  genes: ArtworkGeneValues
}

export type CodeNodeRecord = {
  id: string
  parentId: string | null
  role: 'seed' | 'mutation'
  sourceRevision: string
  promotedAt: string | null
  createdAt: string
  available: boolean
}

export class ControlApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ControlApiError'
    this.status = status
  }
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Browser storage is unavailable: ${message}`)
  }
}

export function getControlApiToken(): string | null {
  const store = storage()
  if (store === null) return null
  try {
    return store.getItem(TOKEN_STORAGE_KEY)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read the installation token: ${message}`)
  }
}

export function saveControlApiToken(value: string): void {
  const token = value.trim()
  if (!/^[\da-f]{64}$/i.test(token)) {
    throw new Error('The installation token must be 64 hexadecimal characters')
  }
  const store = storage()
  if (store === null) throw new Error('Browser storage is unavailable')
  try {
    store.setItem(TOKEN_STORAGE_KEY, token)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not save the installation token: ${message}`)
  }
}

export type PairingStatus = {
  pin: string
  expiresAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addAuthorizationHeader(headers: Headers): Headers {
  const token = getControlApiToken()
  if (token !== null) headers.set('authorization', `Bearer ${token}`)
  return headers
}

function parseGene(value: unknown): ArtworkGene {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.defaultValue !== 'number' ||
    typeof value.min !== 'number' ||
    typeof value.max !== 'number' ||
    typeof value.step !== 'number' ||
    ![value.defaultValue, value.min, value.max, value.step].every(Number.isFinite)
  ) {
    throw new Error('Control API returned an invalid Gene declaration')
  }

  return {
    id: value.id,
    label: value.label,
    defaultValue: value.defaultValue,
    min: value.min,
    max: value.max,
    step: value.step,
  }
}

function isRuntimeKind(value: unknown): value is RuntimeKind {
  return value === 'p5' || value === 'canvas2d' || value === 'three' || value === 'shader'
}

function parseIdentity(value: unknown, field: string): { id: string } | null {
  if (value === null) return null
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error(`Control API returned an invalid ${field}`)
  }

  return { id: value.id }
}

function parseModule(value: unknown): PresenceSnapshot['module'] {
  if (value === null) return null
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.label !== 'string' ||
    !isRuntimeKind(value.runtime) ||
    !Array.isArray(value.genes)
  ) {
    throw new Error('Control API returned an invalid module declaration')
  }

  return {
    id: value.id,
    label: value.label,
    genes: value.genes.map(parseGene),
    runtime: value.runtime,
  }
}

function parseGeneValues(value: unknown): ArtworkGeneValues | null {
  if (value === null) return null
  if (!isRecord(value)) throw new Error('Control API returned invalid Gene values')

  const genes: Record<string, number> = {}
  for (const [id, gene] of Object.entries(value)) {
    if (typeof gene !== 'number' || !Number.isFinite(gene)) {
      throw new Error(`Control API returned an invalid value for Gene ${id}`)
    }
    genes[id] = gene
  }
  return genes
}

function parseImprint(value: unknown): ImprintRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    (value.parentId !== null && typeof value.parentId !== 'string') ||
    typeof value.codeId !== 'string' ||
    typeof value.sourceRevision !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    throw new Error('Control API returned an invalid Imprint')
  }
  const genes = parseGeneValues(value.genes)
  if (genes === null) throw new Error('Control API returned invalid Imprint Genes')

  return {
    id: value.id,
    parentId: value.parentId,
    codeId: value.codeId,
    sourceRevision: value.sourceRevision,
    createdAt: value.createdAt,
    genes,
  }
}

function parseCodeNode(value: unknown): CodeNodeRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    (value.parentId !== null && typeof value.parentId !== 'string') ||
    (value.role !== 'seed' && value.role !== 'mutation') ||
    typeof value.sourceRevision !== 'string' ||
    (value.promotedAt !== null && typeof value.promotedAt !== 'string') ||
    typeof value.createdAt !== 'string' ||
    typeof value.available !== 'boolean'
  ) {
    throw new Error('Control API returned an invalid code node')
  }

  return {
    id: value.id,
    parentId: value.parentId,
    role: value.role,
    sourceRevision: value.sourceRevision,
    promotedAt: value.promotedAt,
    createdAt: value.createdAt,
    available: value.available,
  }
}

function parsePresenceSnapshot(value: unknown): PresenceSnapshot {
  if (
    !isRecord(value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision)
  ) {
    throw new Error('Control API returned an invalid Presence snapshot')
  }

  return {
    revision: value.revision,
    code: parseIdentity(value.code, 'code node'),
    imprint: parseIdentity(value.imprint, 'Imprint'),
    module: parseModule(value.module),
    genes: parseGeneValues(value.genes),
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers)
  headers.set('accept', 'application/json')
  if (init?.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  const token = getControlApiToken()
  if (token !== null) headers.set('authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  const responseText = await response.text()
  let body: unknown
  try {
    body = JSON.parse(responseText)
  } catch {
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : ''
      throw new ControlApiError(
        response.status,
        `Control API returned HTTP ${response.status}${statusText} with a non-JSON response`,
      )
    }
    throw new Error('Control API returned invalid JSON')
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === 'string' ? body.error : response.statusText
    throw new ControlApiError(response.status, message || `Request failed (${response.status})`)
  }
  return body
}

export async function getPairingStatus(): Promise<PairingStatus | null> {
  const value = await request('/pairing/status')
  if (value === null) return null
  if (
    !isRecord(value) ||
    typeof value.pin !== 'string' ||
    !/^\d{6}$/.test(value.pin) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt)
  ) {
    throw new Error('Control API returned an invalid pairing status')
  }
  return { pin: value.pin, expiresAt: value.expiresAt }
}

export async function requestPairingPin(): Promise<number> {
  const value = await request('/pairing/request', { method: 'POST' })
  if (
    !isRecord(value) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt)
  ) {
    throw new Error('Control API returned an invalid pairing request')
  }
  return value.expiresAt
}

export async function completePairing(pin: string): Promise<string> {
  if (!/^\d{6}$/.test(pin)) throw new Error('Pairing code must contain six digits')
  const value = await request('/pairing/complete', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
  if (!isRecord(value) || typeof value.token !== 'string' || !/^[\da-f]{64}$/i.test(value.token)) {
    throw new Error('Control API returned an invalid pairing credential')
  }
  return value.token
}

export async function dismissPairingPin(): Promise<void> {
  await request('/pairing/dismiss', { method: 'POST' })
}

export async function getPresence(): Promise<PresenceSnapshot> {
  return parsePresenceSnapshot(await request('/presence'))
}

export async function selectCode(id: string): Promise<PresenceSnapshot> {
  return parsePresenceSnapshot(
    await request('/presence', {
      method: 'POST',
      body: JSON.stringify({ kind: 'code', id }),
    }),
  )
}

export async function selectImprint(id: string): Promise<PresenceSnapshot> {
  return parsePresenceSnapshot(
    await request('/presence', {
      method: 'POST',
      body: JSON.stringify({ kind: 'imprint', id }),
    }),
  )
}

export async function listImprints(): Promise<readonly ImprintRecord[]> {
  const result = await request('/imprints')
  if (!Array.isArray(result)) throw new Error('Control API returned an invalid Imprint list')
  return result.map(parseImprint)
}

export async function listCodeNodes(): Promise<readonly CodeNodeRecord[]> {
  const result = await request('/code-nodes')
  if (!Array.isArray(result)) throw new Error('Control API returned an invalid code-node list')
  return result.map(parseCodeNode)
}

export async function setGenes(genes: ArtworkGeneValues): Promise<void> {
  await request('/presence/genes', {
    method: 'PUT',
    body: JSON.stringify({ genes }),
  })
}

export async function createImprint(): Promise<{ id: string }> {
  const result = await request('/imprints', { method: 'POST', body: '{}' })
  if (!isRecord(result) || typeof result.id !== 'string') {
    throw new Error('Control API returned an invalid Imprint')
  }
  return { id: result.id }
}

export type PreviewKind = 'code' | 'imprint'
export type PreviewAsset = 'poster' | 'animation'

async function throwPreviewApiError(response: Response): Promise<never> {
  const responseText = await response.text()
  let message = response.statusText || `Request failed (${response.status})`
  try {
    const body: unknown = JSON.parse(responseText)
    if (isRecord(body) && typeof body.error === 'string') message = body.error
  } catch {
    if (responseText === '') message = `Control API returned HTTP ${response.status}`
  }
  throw new ControlApiError(response.status, message)
}

function previewHeaders(accept: string, contentType?: string): Headers {
  const headers = new Headers({ accept })
  if (contentType !== undefined) headers.set('content-type', contentType)
  const token = getControlApiToken()
  if (token !== null) headers.set('authorization', `******`)
  return headers
}

export async function getLineagePreview(
  kind: PreviewKind,
  id: string,
  asset: PreviewAsset = 'poster',
): Promise<Blob | null> {
  const path = `/previews/${kind}/${encodeURIComponent(id)}/${asset}`
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: addAuthorizationHeader(
      previewHeaders(asset === 'poster' ? 'image/webp,image/png' : 'image/gif'),
    ),
  })
  if (response.status === 204 || response.status === 404) return null
  if (!response.ok) await throwPreviewApiError(response)

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  const validContentType =
    asset === 'poster'
      ? contentType === 'image/png' || contentType === 'image/webp'
      : contentType === 'image/gif'
  if (!validContentType) {
    throw new Error('Control API returned an invalid preview content type')
  }
  return response.blob()
}

export async function saveLineagePreview(
  kind: PreviewKind,
  id: string,
  preview: Blob,
  asset: PreviewAsset = 'poster',
): Promise<void> {
  const validContentType =
    asset === 'poster'
      ? preview.type === 'image/png' || preview.type === 'image/webp'
      : preview.type === 'image/gif'
  const maxBytes = asset === 'poster' ? 128 * 1024 : 512 * 1024
  if (!validContentType || preview.size === 0 || preview.size > maxBytes) {
    throw new Error(
      asset === 'poster'
        ? 'Preview must be a non-empty PNG or WebP image no larger than 128 KiB'
        : 'Animation must be a non-empty GIF no larger than 512 KiB',
    )
  }
  const path = `/previews/${kind}/${encodeURIComponent(id)}/${asset}`
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: addAuthorizationHeader(previewHeaders('application/json', preview.type)),
    body: preview,
  })
  if (!response.ok) await throwPreviewApiError(response)
}

export async function deleteImprint(id: string): Promise<void> {
  await request(`/imprints/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function subscribeToPresence(
  onPresence: (snapshot: PresenceSnapshot) => void,
  onOpen: () => void,
  onError: (error: Error) => void,
): () => void {
  let closed = false
  let controller: AbortController | null = null
  let previousError: string | null = null

  const dispatchFrame = (frame: string) => {
    const lines = frame.split(/\r?\n/)
    const event = lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim()
    if (event !== 'presence') return

    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    try {
      onPresence(parsePresenceSnapshot(JSON.parse(data)))
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  const stream = async () => {
    while (!closed) {
      controller = new AbortController()
      try {
        const headers = new Headers({ accept: 'text/event-stream' })
        const token = getControlApiToken()
        if (token !== null) headers.set('authorization', `Bearer ${token}`)
        const response = await fetch(`${API_BASE_URL}/presence/events`, {
          headers,
          signal: controller.signal,
        })
        if (!response.ok) {
          let message = response.statusText || `Request failed (${response.status})`
          try {
            const body: unknown = await response.json()
            if (isRecord(body) && typeof body.error === 'string') message = body.error
          } catch {
            // The status text remains available when the API error body is not JSON.
          }
          throw new ControlApiError(response.status, message)
        }
        if (response.body === null) throw new Error('Control API returned an empty event stream')

        onOpen()
        previousError = null
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!closed) {
          const { value, done } = await reader.read()
          if (done) throw new Error('Presence event stream ended')
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split(/\r?\n\r?\n/)
          buffer = frames.pop() ?? ''
          for (const frame of frames) dispatchFrame(frame)
        }
      } catch (error) {
        if (closed || controller.signal.aborted) return
        const failure = error instanceof Error ? error : new Error(String(error))
        if (failure.message !== previousError) {
          previousError = failure.message
          onError(failure)
        }
        if (failure instanceof ControlApiError && failure.status === 401) return
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
  }

  void stream()
  return () => {
    closed = true
    controller?.abort()
  }
}
