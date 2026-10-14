import type { ArtworkParameter, ArtworkParameterValues } from './seeds/types'

const API_BASE_URL = 'http://127.0.0.1:4317/api/v1'

export type PresenceSnapshot = {
  revision: number
  code: { id: string } | null
  imprint: { id: string } | null
  module: {
    id: string
    label?: string
    parameters: readonly ArtworkParameter[]
  } | null
  parameters: ArtworkParameterValues | null
}

export type ImprintRecord = {
  id: string
  parentId: string | null
  codeId: string
  sourceRevision: string
  createdAt: string
  parameters: ArtworkParameterValues
}

export class ControlApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ControlApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseParameter(value: unknown): ArtworkParameter {
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
    throw new Error('Control API returned an invalid parameter declaration')
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
    (value.label !== undefined && typeof value.label !== 'string') ||
    !Array.isArray(value.parameters)
  ) {
    throw new Error('Control API returned an invalid module declaration')
  }

  return {
    id: value.id,
    ...(typeof value.label === 'string' ? { label: value.label } : {}),
    parameters: value.parameters.map(parseParameter),
  }
}

function parseParameterValues(value: unknown): ArtworkParameterValues | null {
  if (value === null) return null
  if (!isRecord(value)) throw new Error('Control API returned invalid parameter values')

  const parameters: Record<string, number> = {}
  for (const [id, parameter] of Object.entries(value)) {
    if (typeof parameter !== 'number' || !Number.isFinite(parameter)) {
      throw new Error(`Control API returned an invalid value for parameter ${id}`)
    }
    parameters[id] = parameter
  }
  return parameters
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
  const parameters = parseParameterValues(value.parameters)
  if (parameters === null) throw new Error('Control API returned invalid Imprint parameters')

  return {
    id: value.id,
    parentId: value.parentId,
    codeId: value.codeId,
    sourceRevision: value.sourceRevision,
    createdAt: value.createdAt,
    parameters,
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
    parameters: parseParameterValues(value.parameters),
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init?.headers,
    },
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('Control API returned invalid JSON')
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === 'string' ? body.error : response.statusText
    throw new ControlApiError(response.status, message || `Request failed (${response.status})`)
  }
  return body
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

export async function setParameters(parameters: ArtworkParameterValues): Promise<void> {
  await request('/presence/parameters', {
    method: 'PUT',
    body: JSON.stringify({ parameters }),
  })
}

export async function createImprint(): Promise<{ id: string }> {
  const result = await request('/imprints', { method: 'POST', body: '{}' })
  if (!isRecord(result) || typeof result.id !== 'string') {
    throw new Error('Control API returned an invalid Imprint')
  }
  return { id: result.id }
}

export async function deleteImprint(id: string): Promise<void> {
  await request(`/imprints/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function subscribeToPresence(
  onPresence: (snapshot: PresenceSnapshot) => void,
  onOpen: () => void,
  onError: (error: Error) => void,
): () => void {
  const events = new EventSource(`${API_BASE_URL}/presence/events`)
  events.addEventListener('presence', (event) => {
    if (!(event instanceof MessageEvent)) {
      onError(new Error('Control API sent an invalid Presence event'))
      return
    }
    try {
      onPresence(parsePresenceSnapshot(JSON.parse(event.data)))
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  })
  events.onopen = onOpen
  events.onerror = () => onError(new Error('Connection to the local control API was interrupted'))
  return () => events.close()
}
