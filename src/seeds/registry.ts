import { driftingFilamentsSeed } from './driftingFilaments'
import { firstLightSeed } from './firstLight'
import type { ArtworkSeed } from './types'

export const artworkSeeds: readonly ArtworkSeed[] = [firstLightSeed, driftingFilamentsSeed]

export const defaultArtworkSeed = firstLightSeed
