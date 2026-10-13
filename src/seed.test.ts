import { describe, expect, it } from 'vitest'
import { seedToNumber } from './seed'

describe('seedToNumber', () => {
  it('returns the same number for the same seed', () => {
    expect(seedToNumber('first-light')).toBe(seedToNumber('first-light'))
  })

  it('distinguishes different seeds', () => {
    expect(seedToNumber('first-light')).not.toBe(seedToNumber('deep-water'))
  })

  it('returns an unsigned 32-bit integer', () => {
    const value = seedToNumber('physis')
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(0xffffffff)
  })
})
