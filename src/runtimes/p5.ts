import p5 from 'p5'
import type { ArtworkParameterValues } from '../seeds/types'
import type { P5Seed } from '../seeds/p5'

export function mountP5Runtime(
  container: HTMLDivElement,
  seed: P5Seed,
  getParameters: () => ArtworkParameterValues,
  onFpsChange?: (fps: number) => void,
): () => void {
  let disposed = false
  // p5 may reach setup after its host component has already unmounted.
  const artwork = new p5((instance) => {
    seed.createSketch(instance, getParameters)

    const { setup } = instance
    instance.setup = async () => {
      if (disposed) {
        await instance.remove()
        return
      }
      await setup?.call(instance)
    }
  }, container)
  let previousFrameCount = artwork.frameCount
  let previousSampleTime = performance.now()
  const fpsInterval =
    onFpsChange === undefined
      ? undefined
      : window.setInterval(() => {
          if (disposed) return

          const sampleTime = performance.now()
          const elapsed = sampleTime - previousSampleTime
          const frameCount = artwork.frameCount
          if (elapsed > 0) {
            onFpsChange(Math.round(((frameCount - previousFrameCount) * 1000) / elapsed))
          }
          previousFrameCount = frameCount
          previousSampleTime = sampleTime
        }, 1000)

  return () => {
    disposed = true
    if (fpsInterval !== undefined) window.clearInterval(fpsInterval)
    artwork.remove()
  }
}
