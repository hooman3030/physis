import { describe, expect, it } from 'vitest'
import { encodePingPongGif } from '../../../../src/ui/archive/encodePingPongGif'
import {
  MAX_GIF_BYTES,
  MAX_GIF_DIMENSION,
  MAX_GIF_FRAMES,
  MAX_GIF_SOURCE_FRAMES,
} from '../../../../src/ui/archive/gifLimits'

function countFrames(bytes: Uint8Array): number {
  let offset = 13
  const screenFlags = bytes[10] ?? 0
  if ((screenFlags & 0x80) !== 0) offset += 3 * 2 ** ((screenFlags & 0x07) + 1)
  let frames = 0

  while (offset < bytes.length) {
    const marker = bytes[offset++]
    if (marker === 0x3b) return frames
    if (marker === 0x21) {
      offset += 1
      while (offset < bytes.length) {
        const size = bytes[offset++]
        if (size === undefined || size === 0) break
        offset += size
      }
      continue
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) {
      throw new Error('Test GIF has an invalid block')
    }

    const frameFlags = bytes[offset + 8] ?? 0
    offset += 9
    if ((frameFlags & 0x80) !== 0) offset += 3 * 2 ** ((frameFlags & 0x07) + 1)
    offset += 1
    while (offset < bytes.length) {
      const size = bytes[offset++]
      if (size === undefined || size === 0) break
      offset += size
    }
    frames += 1
  }
  throw new Error('Test GIF has no trailer')
}

describe('ping-pong GIF encoding', () => {
  it('encodes forward frames followed by the reverse interior within the output caps', () => {
    const frames = [
      new Uint8Array([255, 0, 0, 255]),
      new Uint8Array([0, 255, 0, 255]),
      new Uint8Array([0, 0, 255, 255]),
    ]

    const encoded = encodePingPongGif(frames, 1, 1)

    expect(encoded).not.toBeNull()
    expect(encoded?.length).toBeLessThanOrEqual(MAX_GIF_BYTES)
    expect(encoded?.[0]).toBe(0x47)
    expect(countFrames(encoded ?? new Uint8Array())).toBe(4)
    expect(MAX_GIF_FRAMES).toBe(24)
  })

  it('skips invalid dimensions, frame counts, and pixel buffers', () => {
    const frame = new Uint8Array([0, 0, 0, 255])

    expect(encodePingPongGif([frame, frame], MAX_GIF_DIMENSION + 1, 1)).toBeNull()
    expect(
      encodePingPongGif(
        Array.from({ length: MAX_GIF_SOURCE_FRAMES + 1 }, () => frame),
        1,
        1,
      ),
    ).toBeNull()
    expect(encodePingPongGif([frame, new Uint8Array(3)], 1, 1)).toBeNull()
  })
})
