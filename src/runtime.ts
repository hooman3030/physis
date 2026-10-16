import { mountP5Runtime } from './runtimes/p5'
import type { P5Seed } from './seeds/p5/types'
import { mountThreeRuntime } from './runtimes/three'
import type { ThreeSeed } from './seeds/three/types'
import type { AuraId } from './auras/types'
import type { ToneMappingId } from './auras/toneMapping'
import type { ArtworkGeneValues } from './seeds/types'
import type { PlaybackClockOptions } from './playbackClock'

export type SeedModule = P5Seed | ThreeSeed

export type SeedRuntime = {
  setPaused: (paused: boolean) => void
  setSpeed: (speed: number) => void
  setAura?: (auraId: AuraId) => void
  setToneMapping?: (toneMappingId: ToneMappingId) => void
  dispose: () => void
}

export function mountSeedRuntime(
  container: HTMLDivElement,
  seed: SeedModule,
  getGenes: () => ArtworkGeneValues,
  onFpsChange?: (fps: number) => void,
  initialPlayback: PlaybackClockOptions = {},
  initialAuraId: AuraId | null = null,
  initialToneMappingId: ToneMappingId | null = null,
): SeedRuntime {
  switch (seed.runtime) {
    case 'p5':
      return mountP5Runtime(container, seed, getGenes, onFpsChange, initialPlayback)
    case 'three':
      return mountThreeRuntime(
        container,
        seed,
        getGenes,
        onFpsChange,
        initialPlayback,
        initialAuraId,
        initialToneMappingId,
      )
    default: {
      const unsupportedRuntime: never = seed
      throw new Error(`No runtime adapter is registered for "${unsupportedRuntime}"`)
    }
  }
}
