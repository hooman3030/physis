import type p5 from 'p5'
import type { PlaybackFrame } from '../../playbackClock'
import type { ArtworkGeneValues, SeedDeclaration } from '../types'

export type P5Seed = SeedDeclaration & {
  runtime: 'p5'
  createSketch: (
    instance: p5,
    getGenes: () => ArtworkGeneValues,
    getPlaybackFrame: () => PlaybackFrame,
  ) => void
}
