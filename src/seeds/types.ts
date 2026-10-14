export type ArtworkGene = {
  id: string
  label: string
  defaultValue: number
  min: number
  max: number
  step: number
}

export type ArtworkGeneValues = Readonly<Record<string, number>>

export type RuntimeKind = 'p5' | 'canvas2d' | 'three' | 'shader'

export type SeedDeclaration = {
  id: string
  label: string
  genes: readonly ArtworkGene[]
  runtime: RuntimeKind
}
