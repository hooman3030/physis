import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { HttpError } from './api/http'

export const MAX_PREVIEW_BYTES = 128 * 1024
export const MAX_ANIMATION_BYTES = 512 * 1024
const MAX_PREVIEW_DIMENSION = 256
const MAX_ANIMATION_DIMENSION = 128
const MAX_ANIMATION_FRAMES = 24
const PREVIEW_ID_PATTERN = /^[\da-z_-]{1,64}$/i
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export type PreviewKind = 'code' | 'imprint'
export type PreviewAsset = 'poster' | 'animation'
export type PreviewImage = {
  bytes: Buffer
  contentType: 'image/png' | 'image/webp' | 'image/gif'
}

function previewDimensions(bytes: Buffer, contentType: string): [number, number] | null {
  if (contentType === 'image/png') {
    if (
      bytes.length < 24 ||
      !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR'
    ) {
      return null
    }
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
  }

  if (contentType !== 'image/webp' || bytes.length < 25) return null
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    return null
  }

  const chunk = bytes.toString('ascii', 12, 16)
  if (chunk === 'VP8X' && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    return [width, height]
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8)
    const height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    return [width, height]
  }
  if (
    chunk === 'VP8 ' &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff]
  }
  return null
}

function validatePoster(bytes: Buffer, contentType: string): PreviewImage {
  if (bytes.length === 0 || bytes.length > MAX_PREVIEW_BYTES) {
    throw new HttpError(413, 'Preview must be between 1 byte and 128 KiB')
  }
  if (contentType !== 'image/png' && contentType !== 'image/webp') {
    throw new HttpError(415, 'Preview must be PNG or WebP')
  }

  const dimensions = previewDimensions(bytes, contentType)
  if (dimensions === null) throw new HttpError(415, 'Preview image data is invalid')
  if (
    dimensions.some(
      (dimension) =>
        !Number.isSafeInteger(dimension) || dimension < 1 || dimension > MAX_PREVIEW_DIMENSION,
    )
  ) {
    throw new HttpError(413, 'Preview dimensions must not exceed 256 by 256 pixels')
  }
  return { bytes, contentType }
}

function skipGifSubBlocks(bytes: Buffer, start: number): number | null {
  let offset = start
  while (offset < bytes.length) {
    const size = bytes[offset++]
    if (size === undefined) return null
    if (size === 0) return offset
    offset += size
    if (offset > bytes.length) return null
  }
  return null
}

function validateAnimation(bytes: Buffer): PreviewImage {
  if (bytes.length === 0 || bytes.length > MAX_ANIMATION_BYTES) {
    throw new HttpError(413, 'Animation must be between 1 byte and 512 KiB')
  }
  if (
    bytes.length < 14 ||
    (bytes.toString('ascii', 0, 6) !== 'GIF87a' && bytes.toString('ascii', 0, 6) !== 'GIF89a')
  ) {
    throw new HttpError(415, 'Animation data must be a valid GIF')
  }

  const width = bytes.readUInt16LE(6)
  const height = bytes.readUInt16LE(8)
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_ANIMATION_DIMENSION ||
    height > MAX_ANIMATION_DIMENSION
  ) {
    throw new HttpError(413, 'Animation dimensions must not exceed 128 by 128 pixels')
  }

  let offset = 13
  const screenFlags = bytes[10] ?? 0
  if ((screenFlags & 0x80) !== 0) offset += 3 * 2 ** ((screenFlags & 0x07) + 1)
  let frameCount = 0
  let hasTrailer = false

  while (offset < bytes.length) {
    const marker = bytes[offset++]
    if (marker === 0x3b) {
      hasTrailer = offset === bytes.length
      break
    }
    if (marker === 0x21) {
      if (offset >= bytes.length) break
      offset += 1
      const nextOffset = skipGifSubBlocks(bytes, offset)
      if (nextOffset === null) break
      offset = nextOffset
      continue
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) break

    const descriptor = offset
    const left = bytes.readUInt16LE(descriptor)
    const top = bytes.readUInt16LE(descriptor + 2)
    const frameWidth = bytes.readUInt16LE(descriptor + 4)
    const frameHeight = bytes.readUInt16LE(descriptor + 6)
    const frameFlags = bytes[descriptor + 8] ?? 0
    if (
      frameWidth < 1 ||
      frameHeight < 1 ||
      left + frameWidth > width ||
      top + frameHeight > height
    ) {
      break
    }
    offset += 9
    if ((frameFlags & 0x80) !== 0) offset += 3 * 2 ** ((frameFlags & 0x07) + 1)
    if (offset >= bytes.length) break
    offset += 1
    const nextOffset = skipGifSubBlocks(bytes, offset)
    if (nextOffset === null) break
    offset = nextOffset
    frameCount += 1
    if (frameCount > MAX_ANIMATION_FRAMES) {
      throw new HttpError(413, 'Animation must contain no more than 24 frames')
    }
  }

  if (!hasTrailer || frameCount < 2) throw new HttpError(415, 'Animation GIF data is invalid')
  return { bytes, contentType: 'image/gif' }
}

export async function readPreviewUpload(
  request: IncomingMessage,
  asset: PreviewAsset,
): Promise<PreviewImage> {
  const contentType = (request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
  const allowedTypes = asset === 'poster' ? ['image/png', 'image/webp'] : ['image/gif']
  if (!allowedTypes.includes(contentType)) {
    throw new HttpError(415, `Content-Type is not valid for the ${asset} preview`)
  }

  const chunks: Buffer[] = []
  let size = 0
  const maxBytes = asset === 'poster' ? MAX_PREVIEW_BYTES : MAX_ANIMATION_BYTES
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) throw new HttpError(413, `${asset} preview exceeds its byte limit`)
    chunks.push(bytes)
  }
  const bytes = Buffer.concat(chunks)
  return asset === 'poster' ? validatePoster(bytes, contentType) : validateAnimation(bytes)
}

function previewPath(directory: string, kind: PreviewKind, id: string): string {
  if (!PREVIEW_ID_PATTERN.test(id)) throw new HttpError(400, 'Invalid preview ID')
  return join(directory, kind, id)
}

export class PreviewStore {
  constructor(private readonly directory: string) {}

  async get(kind: PreviewKind, id: string, asset: PreviewAsset): Promise<PreviewImage | null> {
    try {
      const bytes = await readFile(join(previewPath(this.directory, kind, id), asset))
      if (asset === 'animation') return validateAnimation(bytes)
      const contentType = bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
        ? 'image/png'
        : 'image/webp'
      return validatePoster(bytes, contentType)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
      throw error
    }
  }

  async put(
    kind: PreviewKind,
    id: string,
    asset: PreviewAsset,
    preview: PreviewImage,
  ): Promise<void> {
    const directory = previewPath(this.directory, kind, id)
    await mkdir(directory, { recursive: true })
    const target = join(directory, asset)
    const temporary = join(directory, `.${asset}-${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, preview.bytes, { flag: 'wx' })
      await rename(temporary, target)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  async remove(kind: PreviewKind, id: string): Promise<void> {
    await rm(previewPath(this.directory, kind, id), { recursive: true, force: true })
  }
}
