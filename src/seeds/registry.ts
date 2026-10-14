import { driftingFilamentsSeed } from './driftingFilaments'
import { firstLightSeed } from './firstLight'
import type { P5Seed } from './p5'

export const artworkSeeds: readonly P5Seed[] = [driftingFilamentsSeed, firstLightSeed]

export const defaultArtworkSeed = firstLightSeed
