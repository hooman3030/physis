import { useEffect, useRef } from 'react'
import { mountSeedRuntime, type SeedModule } from './runtime'
import type { ArtworkParameterValues } from './seeds/types'

type ArtworkCanvasProps = {
  seed: SeedModule
  parameters: ArtworkParameterValues
  onFpsChange?: (fps: number | null) => void
}

export function ArtworkCanvas({ seed, parameters, onFpsChange }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const parametersRef = useRef(parameters)

  useEffect(() => {
    parametersRef.current = parameters
  }, [parameters])

  useEffect(() => {
    if (!containerRef.current) return

    onFpsChange?.(null)
    return mountSeedRuntime(containerRef.current, seed, () => parametersRef.current, onFpsChange)
  }, [seed, onFpsChange])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
