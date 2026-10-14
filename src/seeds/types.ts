export type ArtworkParameter = {
  id: string
  label: string
  defaultValue: number
  min: number
  max: number
  step: number
}

export type ArtworkParameterValues = Readonly<Record<string, number>>

export type RuntimeKind = 'p5' | 'canvas2d' | 'three' | 'shader'

export type SeedDeclaration = {
  id: string
  label: string
  parameters: readonly ArtworkParameter[]
  runtime: RuntimeKind
}
