import type { Camera, Scene, WebGPURenderer } from 'three/webgpu'
import type { PlaybackFrame } from '../../playbackClock'
import type { ArtworkGeneValues, SeedDeclaration } from '../types'

export type ThreeSeedContext = {
  renderer: WebGPURenderer
  getViewportSize: () => { width: number; height: number }
  /** Pointer over the canvas: 0..1 with y pointing up, plus whether a button or touch is down; null when absent. */
  getPointer: () => { x: number; y: number; pressed: boolean } | null
  registerCleanup: (cleanup: () => void) => void
}

export type ThreeSeed = SeedDeclaration & {
  runtime: 'three'
  requiresWebGPUCompute?: boolean
  createScene: (
    scene: Scene,
    camera: Camera,
    getGenes: () => ArtworkGeneValues,
    context: ThreeSeedContext,
  ) => (frame: PlaybackFrame) => void
}
