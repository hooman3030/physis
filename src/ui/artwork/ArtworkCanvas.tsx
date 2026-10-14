import { useEffect, useRef } from 'react'
import { mountSeedRuntime, type SeedModule } from '../../runtime'
import type { ArtworkGeneValues } from '../../seeds/types'

type ArtworkCanvasProps = {
  seed: SeedModule
  genes: ArtworkGeneValues
  onFpsChange?: (fps: number | null) => void
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export function ArtworkCanvas({ seed, genes, onFpsChange, onCanvasReady }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const genesRef = useRef(genes)
  const onCanvasReadyRef = useRef(onCanvasReady)

  useEffect(() => {
    genesRef.current = genes
  }, [genes])

  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady
  }, [onCanvasReady])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    onFpsChange?.(null)
    let currentCanvas: HTMLCanvasElement | null = null
    const notifyCanvas = () => {
      const canvas = container.querySelector('canvas')
      const nextCanvas = canvas instanceof HTMLCanvasElement ? canvas : null
      if (nextCanvas === currentCanvas) return
      currentCanvas = nextCanvas
      onCanvasReadyRef.current?.(nextCanvas)
    }
    const observer = new MutationObserver(notifyCanvas)
    observer.observe(container, { childList: true, subtree: true })
    const dispose = mountSeedRuntime(container, seed, () => genesRef.current, onFpsChange)
    notifyCanvas()
    return () => {
      observer.disconnect()
      onCanvasReadyRef.current?.(null)
      dispose()
    }
  }, [seed, onFpsChange])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
