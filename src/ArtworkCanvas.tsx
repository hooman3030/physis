import { useEffect, useRef } from 'react'
import { mountSeedRuntime, type SeedModule } from './runtime'
import type { ArtworkParameterValues } from './seeds/types'

type ArtworkCanvasProps = {
  seed: SeedModule
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

    return mountSeedRuntime(containerRef.current, seed, () => parametersRef.current)
  }, [seed])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
