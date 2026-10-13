import { describe, expect, it } from 'vitest'
import { seedToNumber } from './seed-id'
import { artworkSeeds, defaultArtworkSeed } from './seeds/registry'

describe('artwork seeds', () => {
  it('provides a pre-built default seed module', () => {
    expect(defaultArtworkSeed).toBe(artworkSeeds[0])
    expect(defaultArtworkSeed.id).toBe('first-light')
    expect(typeof defaultArtworkSeed.createSketch).toBe('function')
  })

  it('registers seeds with unique ids and distinct randomness', () => {
    const ids = artworkSeeds.map((seed) => seed.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('drifting-filaments')
    expect(new Set(ids.map(seedToNumber)).size).toBe(ids.length)
  })

  it('derives stable randomness for a module implementation', () => {
    expect(seedToNumber(defaultArtworkSeed.id)).toBe(seedToNumber('first-light'))
  })
})
