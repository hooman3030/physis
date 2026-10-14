import { useEffect, useRef } from 'react'
import { mountSeedRuntime, type SeedModule } from '../../runtime'
import type { ArtworkGeneValues } from '../../seeds/types'

type ArtworkCanvasProps = {
  seed: SeedModule
  genes: ArtworkGeneValues
  onFpsChange?: (fps: number | null) => void
}

export function ArtworkCanvas({ seed, genes, onFpsChange }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const genesRef = useRef(genes)

  useEffect(() => {
    genesRef.current = genes
  }, [genes])

  useEffect(() => {
    if (!containerRef.current) return

    onFpsChange?.(null)
    return mountSeedRuntime(containerRef.current, seed, () => genesRef.current, onFpsChange)
  }, [seed, onFpsChange])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
