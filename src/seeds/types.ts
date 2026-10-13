import type p5 from 'p5'

export type ArtworkParameter = {
  id: string
  label: string
  defaultValue: number
  min: number
  max: number
  step: number
}

export type ArtworkParameterValues = Readonly<Record<string, number>>

export type ArtworkSeed = {
  id: string
  label: string
  parameters: readonly ArtworkParameter[]
  createSketch: (instance: p5, getParameters: () => ArtworkParameterValues) => void
}
