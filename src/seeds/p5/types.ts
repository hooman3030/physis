import type p5 from 'p5'
import type { ArtworkParameterValues, SeedDeclaration } from '../types'

export type P5Seed = SeedDeclaration & {
  runtime: 'p5'
  createSketch: (instance: p5, getParameters: () => ArtworkParameterValues) => void
}
