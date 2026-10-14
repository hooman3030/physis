import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureArtworkPreview } from '../../../../src/ui/archive/previewCapture'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('artwork preview capture', () => {
  it('downscales the artwork and prefers a bounded WebP poster', async () => {
    const drawImage = vi.fn()
    const requestedTypes: string[] = []
    const previewCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback, type?: string) => {
        requestedTypes.push(type ?? '')
        callback(new Blob(['poster'], { type: 'image/webp' }))
      },
    } as unknown as HTMLCanvasElement
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(previewCanvas) })
    const artworkCanvas = { width: 640, height: 320 } as HTMLCanvasElement

    const preview = await captureArtworkPreview(artworkCanvas)

    expect(preview?.type).toBe('image/webp')
    expect(drawImage).toHaveBeenCalledWith(artworkCanvas, 0, 0, 256, 128)
    expect(requestedTypes).toEqual(['image/webp'])
  })

  it('falls back to PNG when WebP encoding is unsupported', async () => {
    const requestedTypes: string[] = []
    const previewCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: BlobCallback, type?: string) => {
        requestedTypes.push(type ?? '')
        callback(type === 'image/webp' ? null : new Blob(['poster'], { type: 'image/png' }))
      },
    } as unknown as HTMLCanvasElement
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(previewCanvas) })

    const preview = await captureArtworkPreview({ width: 96, height: 96 } as HTMLCanvasElement)

    expect(preview?.type).toBe('image/png')
    expect(requestedTypes).toEqual(['image/webp', 'image/png'])
  })
})
