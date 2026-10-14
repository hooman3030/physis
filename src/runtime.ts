import { mountP5Runtime } from './runtimes/p5'
import type { P5Seed } from './seeds/p5'
import type { ArtworkParameterValues, RuntimeKind } from './seeds/types'

export type SeedModule = P5Seed

type RuntimeAdapter = {
  mount: (
    container: HTMLDivElement,
    seed: SeedModule,
    getParameters: () => ArtworkParameterValues,
    onFpsChange?: (fps: number) => void,
  ) => () => void
}

const adapters: Partial<Record<RuntimeKind, RuntimeAdapter>> = {
  p5: { mount: mountP5Runtime },
}

export function mountSeedRuntime(
  container: HTMLDivElement,
  seed: SeedModule,
  getParameters: () => ArtworkParameterValues,
  onFpsChange?: (fps: number) => void,
): () => void {
  const adapter = adapters[seed.runtime]
  if (adapter === undefined) {
    throw new Error(`No runtime adapter is registered for "${seed.runtime}"`)
  }

  return adapter.mount(container, seed, getParameters, onFpsChange)
}
