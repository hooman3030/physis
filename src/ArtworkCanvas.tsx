import { useEffect, useRef } from 'react'
import p5 from 'p5'
import type { ArtworkSeed } from './seeds/types'

type ArtworkCanvasProps = {
  seed: ArtworkSeed
}

export function ArtworkCanvas({ seed }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const artwork = new p5(seed.createSketch, containerRef.current)
    return () => artwork.remove()
  }, [seed])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
