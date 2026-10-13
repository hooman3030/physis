import { useEffect, useRef } from 'react'
import p5 from 'p5'
import type { ArtworkParameterValues, ArtworkSeed } from './seeds/types'

type ArtworkCanvasProps = {
  seed: ArtworkSeed
  parameters: ArtworkParameterValues
}

export function ArtworkCanvas({ seed, parameters }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const parametersRef = useRef(parameters)

  useEffect(() => {
    parametersRef.current = parameters
  }, [parameters])

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    // p5 creates its canvas asynchronously and remove() is a no-op before that,
    // so an instance disposed early must remove itself once setup is reached.
    const artwork = new p5((instance) => {
      seed.createSketch(instance, () => parametersRef.current)

      const { setup } = instance
      instance.setup = async () => {
        if (disposed) {
          await instance.remove()
          return
        }
        await setup?.call(instance)
      }
    }, containerRef.current)

    return () => {
      disposed = true
      artwork.remove()
    }
  }, [seed])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
