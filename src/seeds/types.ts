import type { AuraId } from '../auras/types'

export type ArtworkGene = {
  id: string
  label: string
  defaultValue: number
  min: number
  max: number
  step: number
}

type BipolarGeneDeclaration = Omit<ArtworkGene, 'min' | 'max'> & { limit: number }

/** A signed Gene whose range is symmetric (-limit..limit), so 0 sits at the center of its control. */
export function bipolarGene({ limit, ...gene }: BipolarGeneDeclaration): ArtworkGene {
  return { ...gene, min: -limit, max: limit }
}

export function isBipolarGene({ min, max }: ArtworkGene): boolean {
  return min < 0 && min === -max
}

export type ArtworkGeneValues = Readonly<Record<string, number>>

export type RuntimeKind = 'p5' | 'canvas2d' | 'three' | 'shader'

export type SeedDeclaration = {
  id: string
  label: string
  genes: readonly ArtworkGene[]
  runtime: RuntimeKind
  defaultAuraId?: AuraId
}
