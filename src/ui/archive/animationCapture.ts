import { MAX_GIF_DIMENSION, MAX_GIF_SOURCE_FRAMES } from './gifLimits'
import type { GifWorkerRequest, GifWorkerResponse } from './gifWorkerProtocol'

const FRAME_INTERVAL_MS = 125

function requestWorker(
  worker: Worker,
  request: GifWorkerRequest,
  expected: readonly GifWorkerResponse['type'][],
  transfer: Transferable[] = [],
): Promise<GifWorkerResponse> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<GifWorkerResponse>) => {
      if (event.data.type === 'error') {
        cleanup()
        reject(new Error(`GIF worker failed: ${event.data.message}`))
      } else if (expected.includes(event.data.type)) {
        cleanup()
        resolve(event.data)
      }
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      reject(new Error(`GIF worker failed: ${event.message}`))
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(request, transfer)
  })
}

export async function captureArtworkAnimation(
  source: HTMLCanvasElement | null,
): Promise<Blob | null> {
  if (source === null || typeof Worker === 'undefined' || typeof createImageBitmap !== 'function') {
    return null
  }
  if (source.width < 1 || source.height < 1) {
    throw new Error('Artwork canvas has no rendered pixels to animate')
  }

  const scale = Math.min(1, MAX_GIF_DIMENSION / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const worker = new Worker(new URL('./previewEncoder.worker.ts', import.meta.url), {
    type: 'module',
  })

  try {
    await requestWorker(worker, { type: 'start', width, height }, ['ready'])
    for (let index = 0; index < MAX_GIF_SOURCE_FRAMES; index += 1) {
      const bitmap = await createImageBitmap(source)
      await requestWorker(worker, { type: 'frame', index, bitmap }, ['frame-accepted'], [bitmap])
      if (index + 1 < MAX_GIF_SOURCE_FRAMES) {
        await new Promise((resolve) => window.setTimeout(resolve, FRAME_INTERVAL_MS))
      }
    }

    const result = await requestWorker(worker, { type: 'finish' }, ['encoded', 'skipped'])
    if (result.type === 'skipped') return null
    if (result.type !== 'encoded') throw new Error('GIF worker returned an invalid result')
    return new Blob([result.bytes], { type: 'image/gif' })
  } finally {
    worker.terminate()
  }
}
