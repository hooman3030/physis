import { driftingFilamentsSeed } from './p5/drifting-filaments/seed'
import { firstLightSeed } from './p5/first-light/seed'
import { boidsThreeSeed } from './three/boids/seed'
import { firstOrbitSeed } from './three/first-orbit/seed'
import type { P5Seed } from './p5/types'
import type { ThreeSeed } from './three/types'

export type ArtworkSeed = P5Seed | ThreeSeed

export const artworkSeeds: readonly ArtworkSeed[] = [
  driftingFilamentsSeed,
  boidsThreeSeed,
  firstLightSeed,
  firstOrbitSeed,
]

export const defaultArtworkSeed = firstLightSeed
