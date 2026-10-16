import { describe, expect, it } from 'vitest'
import { artworkSeeds, defaultArtworkSeed } from '../../../src/seeds/registry'

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
    expect(ids).toContain('first-orbit')
    expect(artworkSeeds.find((seed) => seed.id === 'first-orbit')?.runtime).toBe('three')
  })
})
