import { describe, expect, it } from 'vitest'
import { artworkSeeds, defaultArtworkSeed } from '../../../src/seeds/registry'
import { bipolarGene, isBipolarGene } from '../../../src/seeds/types'

describe('artwork seeds', () => {
  it('provides a pre-built default seed module', () => {
    expect(artworkSeeds).toContain(defaultArtworkSeed)
    expect(defaultArtworkSeed.id).toBe('first-light')
    expect(defaultArtworkSeed.runtime).toBe('p5')
    expect(typeof defaultArtworkSeed.createSketch).toBe('function')
  })

  it('registers seeds with unique ids and distinct randomness', () => {
    const ids = artworkSeeds.map((seed) => seed.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('drifting-filaments')
    expect(ids).toContain('boids-three')
    expect(ids).toContain('first-orbit')
    expect(ids).not.toContain('drifting-filaments-tsl')
    expect(artworkSeeds.find((seed) => seed.id === 'boids-three')?.runtime).toBe('three')
    expect(artworkSeeds.find((seed) => seed.id === 'boids-three')?.requiresWebGPUCompute).toBe(true)
    expect(artworkSeeds.find((seed) => seed.id === 'first-orbit')?.runtime).toBe('three')
  })

  it('declares bounded flocking controls for the GPU boids seed', () => {
    const seed = artworkSeeds.find((candidate) => candidate.id === 'boids-three')
    expect(seed?.genes.find((gene) => gene.id === 'boidCount')).toMatchObject({
      defaultValue: 128,
      min: 16,
      max: 8192,
    })
    const geneIds = seed?.genes.map((gene) => gene.id)
    expect(geneIds).toEqual(
      expect.arrayContaining(['separationWeight', 'alignmentWeight', 'cohesionWeight']),
    )
    expect(seed?.genes.find((gene) => gene.id === 'separationWeight')?.defaultValue).toBe(1.2)
    expect(seed?.genes.find((gene) => gene.id === 'cohesionWeight')?.defaultValue).toBe(1.1)
    expect(geneIds).toEqual(
      expect.arrayContaining(['separationRadius', 'alignmentRadius', 'cohesionRadius', 'maxForce']),
    )
  })
})

describe('bipolar genes', () => {
  it('declares symmetric ranges with 0 at the center', () => {
    const gene = bipolarGene({ id: 'g', label: 'G', defaultValue: 0, limit: 5, step: 0.5 })
    expect(gene).toEqual({ id: 'g', label: 'G', defaultValue: 0, min: -5, max: 5, step: 0.5 })
    expect(isBipolarGene(gene)).toBe(true)
    expect(isBipolarGene({ ...gene, min: 0 })).toBe(false)
    expect(isBipolarGene({ ...gene, min: -2 })).toBe(false)
  })

  it('marks cursor attraction as bipolar', () => {
    const seed = artworkSeeds.find((candidate) => candidate.id === 'boids-three')
    const gene = seed?.genes.find((candidate) => candidate.id === 'cursorAttraction')
    expect(gene && isBipolarGene(gene)).toBe(true)
  })
})
