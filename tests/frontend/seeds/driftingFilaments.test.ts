import { describe, expect, it } from 'vitest'
import {
  getEffectiveStrokeOpacity,
  getTrailFadeAlpha,
  getWrappedLineSegments,
} from '../../../src/seeds/p5/drifting-filaments/seed'

describe('Drifting Filaments density compensation', () => {
  it('preserves the opacity gene at default density and trail length', () => {
    expect(getEffectiveStrokeOpacity(40, 240, 24)).toBe(40)
  })

  it('reduces stroke opacity when density and trail length would create haze', () => {
    expect(getEffectiveStrokeOpacity(40, 2940, 90)).toBeLessThan(1)
  })
})

describe('Drifting Filaments trail fade', () => {
  it.each([2, 24, 300])('fades to less than one color step within %i frames', (trailLength) => {
    const remaining = Math.pow(1 - getTrailFadeAlpha(trailLength) / 100, trailLength)
    expect(remaining).toBeCloseTo(1 / 1024, 12)
  })
})

describe('Drifting Filaments wrapping', () => {
  it('continues a line from the right edge at the left edge', () => {
    expect(getWrappedLineSegments(98, 50, 103, 52, 100, 100)).toEqual([
      [98, 50, 103, 52],
      [-2, 50, 3, 52],
    ])
  })

  it('continues a line from the left edge at the right edge', () => {
    expect(getWrappedLineSegments(2, 50, -3, 52, 100, 100)).toEqual([
      [2, 50, -3, 52],
      [102, 50, 97, 52],
    ])
  })

  it('continues a line across the top and bottom edges', () => {
    expect(getWrappedLineSegments(50, 2, 52, -3, 100, 100)).toEqual([
      [50, 2, 52, -3],
      [50, 102, 52, 97],
    ])
  })

  it('continues a line from the bottom edge at the top edge', () => {
    expect(getWrappedLineSegments(50, 98, 52, 103, 100, 100)).toEqual([
      [50, 98, 52, 103],
      [50, -2, 52, 3],
    ])
  })

  it('continues a diagonal line across both edges at once', () => {
    expect(getWrappedLineSegments(98, 98, 103, 104, 100, 100)).toEqual([
      [98, 98, 103, 104],
      [98, -2, 103, 4],
      [-2, 98, 3, 104],
      [-2, -2, 3, 4],
    ])
  })
})
