import type { IncomingMessage, ServerResponse } from 'node:http'
import { ArchiveError, type ArchiveErrorCode } from '../archive'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

const ARCHIVE_STATUS: Record<ArchiveErrorCode, number> = {
  'invalid-input': 400,
  'not-found': 404,
  'already-exists': 409,
  'unsupported-schema': 500,
  corrupt: 500,
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  if (error instanceof ArchiveError) {
    const status = ARCHIVE_STATUS[error.code]
    return new HttpError(status, status >= 500 ? 'Archive error' : error.message)
  }
  return new HttpError(500, 'Internal error')
}

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...headers,
  })
  response.end(payload)
}

export const MAX_BODY_BYTES = 64 * 1024

export async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json')
  }

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large')
    chunks.push(chunk as Buffer)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (typeof value !== 'string' || value === '') {
    throw new HttpError(400, `"${key}" must be a non-empty string`)
  }
  return value
}

export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  return body[key] === undefined ? undefined : requireString(body, key)
}

export function optionalInteger(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new HttpError(400, `"${key}" must be an integer`)
  }
  return value
}
