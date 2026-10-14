import { driftingFilamentsSeed } from './p5/drifting-filaments/seed'
import { firstLightSeed } from './p5/first-light/seed'
import type { P5Seed } from './p5/types'

export const artworkSeeds: readonly P5Seed[] = [driftingFilamentsSeed, firstLightSeed]

export const defaultArtworkSeed = firstLightSeed
