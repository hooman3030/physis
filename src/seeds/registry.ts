import { driftingFilamentsSeed } from './driftingFilaments'
import { firstLightSeed } from './firstLight'
import type { ArtworkSeed } from './types'

export const artworkSeeds: readonly ArtworkSeed[] = [driftingFilamentsSeed, firstLightSeed]

export const defaultArtworkSeed = firstLightSeed
