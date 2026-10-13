import type p5 from 'p5'

export type ArtworkSeed = {
  id: string
  label: string
  createSketch: (instance: p5) => void
}
