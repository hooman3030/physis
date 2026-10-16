import { useEffect, useRef } from 'react'
import { mountSeedRuntime, type SeedModule, type SeedRuntime } from '../../runtime'
import type { AuraId } from '../../auras/types'
import type { ToneMappingId } from '../../auras/toneMapping'
import type { ArtworkGeneValues } from '../../seeds/types'

type ArtworkCanvasProps = {
  seed: SeedModule
  genes: ArtworkGeneValues
  paused: boolean
  speed: number
  auraId: AuraId | null
  toneMappingId: ToneMappingId | null
  onFpsChange?: (fps: number | null) => void
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export function ArtworkCanvas({
  seed,
  genes,
  paused,
  speed,
  auraId,
  toneMappingId,
  onFpsChange,
  onCanvasReady,
}: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const genesRef = useRef(genes)
  const pausedRef = useRef(paused)
  const speedRef = useRef(speed)
  const auraIdRef = useRef(auraId)
  const toneMappingIdRef = useRef(toneMappingId)
  const runtimeRef = useRef<SeedRuntime | null>(null)
  const onCanvasReadyRef = useRef(onCanvasReady)

  pausedRef.current = paused
  speedRef.current = speed
  auraIdRef.current = auraId
  toneMappingIdRef.current = toneMappingId

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
    const runtime = mountSeedRuntime(
      container,
      seed,
      () => genesRef.current,
      onFpsChange,
      {
        paused: pausedRef.current,
        speed: speedRef.current,
      },
      seed.runtime === 'three' ? auraIdRef.current : null,
      seed.runtime === 'three' ? toneMappingIdRef.current : null,
    )
    runtimeRef.current = runtime
    notifyCanvas()
    return () => {
      observer.disconnect()
      onCanvasReadyRef.current?.(null)
      runtimeRef.current = null
      runtime.dispose()
    }
  }, [seed, onFpsChange])

  useEffect(() => {
    runtimeRef.current?.setPaused(paused)
  }, [paused])

  useEffect(() => {
    runtimeRef.current?.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    if (seed.runtime === 'three') runtimeRef.current?.setAura?.(auraId ?? 'off')
  }, [auraId, seed.runtime])

  useEffect(() => {
    if (seed.runtime === 'three') {
      runtimeRef.current?.setToneMapping?.(toneMappingId ?? 'none')
    }
  }, [seed.runtime, toneMappingId])

  return <div ref={containerRef} className="artwork-canvas" aria-label={`Artwork: ${seed.label}`} />
}
