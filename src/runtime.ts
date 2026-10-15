import { mountP5Runtime } from './runtimes/p5'
import type { P5Seed } from './seeds/p5/types'
import type { ArtworkGeneValues, RuntimeKind } from './seeds/types'
import type { PlaybackClockOptions } from './playbackClock'

export type SeedModule = P5Seed

export type SeedRuntime = {
  setPaused: (paused: boolean) => void
  setSpeed: (speed: number) => void
  dispose: () => void
}

type RuntimeAdapter = {
  mount: (
    container: HTMLDivElement,
    seed: SeedModule,
    getGenes: () => ArtworkGeneValues,
    onFpsChange?: (fps: number) => void,
    initialPlayback?: PlaybackClockOptions,
  ) => SeedRuntime
}

const adapters: Partial<Record<RuntimeKind, RuntimeAdapter>> = {
  p5: { mount: mountP5Runtime },
}

export function mountSeedRuntime(
  container: HTMLDivElement,
  seed: SeedModule,
  getGenes: () => ArtworkGeneValues,
  onFpsChange?: (fps: number) => void,
  initialPlayback: PlaybackClockOptions = {},
): SeedRuntime {
  const adapter = adapters[seed.runtime]
  if (adapter === undefined) {
    throw new Error(`No runtime adapter is registered for "${seed.runtime}"`)
  }

  return adapter.mount(container, seed, getGenes, onFpsChange, initialPlayback)
}
