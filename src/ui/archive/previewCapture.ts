const MAX_PREVIEW_BYTES = 128 * 1024

function toBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/webp'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob === null) {
            reject(new Error(`Browser could not encode an artwork preview as ${type}`))
          } else {
            resolve(blob)
          }
        },
        type,
        type === 'image/webp' ? 0.78 : undefined,
      )
    } catch (error) {
      reject(error)
    }
  })
}

export async function captureArtworkPreview(
  canvas: HTMLCanvasElement | null,
): Promise<Blob | null> {
  if (canvas === null) return null
  if (canvas.width < 1 || canvas.height < 1) {
    throw new Error('Artwork canvas has no rendered pixels to capture')
  }

  let captureError: unknown
  for (const maxDimension of [256, 192, 128]) {
    const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height))
    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = Math.max(1, Math.round(canvas.width * scale))
    previewCanvas.height = Math.max(1, Math.round(canvas.height * scale))
    const context = previewCanvas.getContext('2d')
    if (context === null) throw new Error('Browser could not create a preview canvas context')
    context.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height)

    for (const type of ['image/webp', 'image/png'] as const) {
      try {
        const blob = await toBlob(previewCanvas, type)
        if (
          (blob.type === 'image/png' || blob.type === 'image/webp') &&
          blob.size > 0 &&
          blob.size <= MAX_PREVIEW_BYTES
        ) {
          previewCanvas.width = 0
          previewCanvas.height = 0
          return blob
        }
      } catch (error) {
        captureError = error
      }
    }
    previewCanvas.width = 0
    previewCanvas.height = 0
  }

  if (captureError instanceof Error) {
    throw new Error(`Could not capture a bounded artwork preview: ${captureError.message}`)
  }
  throw new Error('Artwork preview exceeds the 128 KiB storage limit')
}
