import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import {
  GIF_FRAME_DELAY_MS,
  MAX_GIF_BYTES,
  MAX_GIF_DIMENSION,
  MAX_GIF_FRAMES,
  MAX_GIF_SOURCE_FRAMES,
} from './gifLimits'

export function encodePingPongGif(
  frames: readonly Uint8Array[],
  width: number,
  height: number,
): Uint8Array | null {
  const pixelBytes = width * height * 4
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_GIF_DIMENSION ||
    height > MAX_GIF_DIMENSION ||
    frames.length < 2 ||
    frames.length > MAX_GIF_SOURCE_FRAMES ||
    frames.some((frame) => frame.length !== pixelBytes)
  ) {
    return null
  }

  const cycle = [...frames, ...frames.slice(1, -1).reverse()]
  if (cycle.length > MAX_GIF_FRAMES) return null

  const allPixels = new Uint8Array(frames.length * pixelBytes)
  frames.forEach((frame, index) => allPixels.set(frame, index * pixelBytes))
  const palette = quantize(allPixels, 128, { format: 'rgb444' })
  const encoder = GIFEncoder()

  cycle.forEach((frame, index) => {
    const options =
      index === 0
        ? { palette, repeat: 0, delay: GIF_FRAME_DELAY_MS }
        : { delay: GIF_FRAME_DELAY_MS }
    encoder.writeFrame(applyPalette(frame, palette, 'rgb444'), width, height, options)
  })
  encoder.finish()

  const result = encoder.bytes()
  return result.length <= MAX_GIF_BYTES ? result : null
}
