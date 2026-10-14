import p5 from 'p5'
import type { ArtworkParameterValues } from '../seeds/types'
import type { P5Seed } from '../seeds/p5'

export function mountP5Runtime(
  container: HTMLDivElement,
  seed: P5Seed,
  getParameters: () => ArtworkParameterValues,
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

  return () => {
    disposed = true
    artwork.remove()
  }
}
