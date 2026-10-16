import type { Camera, Scene } from 'three/webgpu'
import type { PlaybackFrame } from '../../playbackClock'
import type { ArtworkGeneValues, SeedDeclaration } from '../types'

export type ThreeSeed = SeedDeclaration & {
  runtime: 'three'
  createScene: (
    scene: Scene,
    camera: Camera,
    getGenes: () => ArtworkGeneValues,
  ) => (frame: PlaybackFrame) => void
}
