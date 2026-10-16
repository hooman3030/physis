import { describe, expect, it } from 'vitest'
import { auraPresets, getAuraPreset, isAuraId } from '../../../src/auras/registry'

describe('Aura presets', () => {
  it('registers the expanded preset set', () => {
    expect(auraPresets.map(({ id }) => id)).toEqual([
      'off',
      'soft-bloom',
      'warm-film',
      'prismatic',
      'vhs',
      'dream-haze',
      'noir',
      'crt',
      'halftone',
      'mosaic',
    ])
  })

  it('gives VHS substantially more grain than the existing film preset', () => {
    const vhs = getAuraPreset('vhs')
    const warmFilm = getAuraPreset('warm-film')

    expect(isAuraId('vhs')).toBe(true)
    expect(vhs.effects.filmGrain?.intensity).toBeGreaterThanOrEqual(0.8)
    expect(vhs.effects.filmGrain?.intensity).toBeGreaterThan(
      warmFilm.effects.filmGrain?.intensity ?? 0,
    )
    expect(vhs.effects.chromaticAberration).toBeDefined()
  })

  it('builds haze and noir from the supported reusable effects', () => {
    expect(getAuraPreset('dream-haze').effects.bloom?.strength).toBeGreaterThan(0.6)
    expect(getAuraPreset('noir').effects.colorGrade?.saturation).toBeLessThan(0.1)
  })

  it('registers scanline, halftone, and pixelation effects on their matching presets', () => {
    expect(getAuraPreset('vhs').effects.scanlines).toBeDefined()
    expect(getAuraPreset('vhs').effects.signalWarp).toBeDefined()
    expect(getAuraPreset('crt').effects.scanlines).toBeDefined()
    expect(getAuraPreset('crt').effects.signalWarp).toBeDefined()
    expect(getAuraPreset('halftone').effects.dotScreen).toBeDefined()
    expect(getAuraPreset('mosaic').effects.pixelation?.pixelSize).toBeGreaterThan(1)
  })
})
