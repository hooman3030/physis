import { encodePingPongGif } from './encodePingPongGif'
import type { GifWorkerRequest, GifWorkerResponse } from './gifWorkerProtocol'

type WorkerScope = typeof globalThis & {
  addEventListener(type: 'message', listener: (event: MessageEvent<GifWorkerRequest>) => void): void
  postMessage(message: GifWorkerResponse, transfer?: Transferable[]): void
}

const scope = globalThis as WorkerScope
let width = 0
let height = 0
let canvas: OffscreenCanvas | null = null
let context: OffscreenCanvasRenderingContext2D | null = null
const frames: Uint8Array[] = []

scope.addEventListener('message', (event) => {
  try {
    const request = event.data
    if (request.type === 'start') {
      width = request.width
      height = request.height
      canvas = new OffscreenCanvas(width, height)
      context = canvas.getContext('2d', { willReadFrequently: true })
      if (context === null) throw new Error('Worker could not create a frame canvas')
      scope.postMessage({ type: 'ready' })
      return
    }

    if (request.type === 'frame') {
      if (context === null) throw new Error('GIF frame capture was not initialized')
      context.drawImage(request.bitmap, 0, 0, width, height)
      const pixels = context.getImageData(0, 0, width, height).data
      frames.push(new Uint8Array(pixels))
      request.bitmap.close()
      scope.postMessage({ type: 'frame-accepted', index: request.index })
      return
    }

    const encoded = encodePingPongGif(frames, width, height)
    if (encoded === null) {
      scope.postMessage({ type: 'skipped' })
      return
    }
    const bytes = new ArrayBuffer(encoded.byteLength)
    new Uint8Array(bytes).set(encoded)
    scope.postMessage({ type: 'encoded', bytes }, [bytes])
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
