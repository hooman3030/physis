import { describe, expect, it } from 'vitest'
import { loadSettings, sanitizeParameterValues, saveSettings } from './persistence'
import { driftingFilamentsSeed } from './seeds/driftingFilaments'
import { firstLightSeed } from './seeds/firstLight'

const seeds = [firstLightSeed, driftingFilamentsSeed]

function memoryStorage(initial?: string) {
  let value = initial ?? null
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next
    },
  }
}

describe('parameter sanitizing', () => {
  it('keeps valid values', () => {
    expect(
      sanitizeParameterValues(driftingFilamentsSeed, {
        filamentCount: 200,
        noiseScale: 0.002,
        stepLength: 2,
      }),
    ).toEqual({ filamentCount: 200, noiseScale: 0.002, stepLength: 2 })
  })

  it('clamps out-of-range values and snaps to the step', () => {
    const values = sanitizeParameterValues(driftingFilamentsSeed, {
      filamentCount: 1_000_000,
      noiseScale: 0,
      stepLength: 1.43,
    })

    const bounds = (id: string) => driftingFilamentsSeed.parameters.find((p) => p.id === id)!

    expect(values.filamentCount).toBe(bounds('filamentCount').max)
    expect(values.noiseScale).toBe(bounds('noiseScale').min)
    expect(values.stepLength).toBe(1.4)
  })

  it('falls back to defaults for missing, non-numeric, and unknown values', () => {
    const values = sanitizeParameterValues(driftingFilamentsSeed, {
      filamentCount: '300',
      noiseScale: Number.NaN,
      unknown: 5,
    })

    expect(values).toEqual({ filamentCount: 160, noiseScale: 0.0014, stepLength: 1.4 })
  })
})

describe('settings storage', () => {
  it('round-trips the active seed and per-seed parameters', () => {
    const storage = memoryStorage()
    saveSettings(
      {
        seed: driftingFilamentsSeed,
        parametersBySeed: {
          'first-light': {},
          'drifting-filaments': { filamentCount: 240, noiseScale: 0.003, stepLength: 3 },
        },
      },
      storage,
    )

    const settings = loadSettings(seeds, firstLightSeed, storage)
    expect(settings.seed).toBe(driftingFilamentsSeed)
    expect(settings.parametersBySeed['drifting-filaments']).toEqual({
      filamentCount: 240,
      noiseScale: 0.003,
      stepLength: 3,
    })
  })

  it('uses defaults when storage is empty, corrupted, or unavailable', () => {
    for (const storage of [
      memoryStorage(),
      memoryStorage('{not json'),
      memoryStorage('42'),
      null,
    ]) {
      const settings = loadSettings(seeds, firstLightSeed, storage)
      expect(settings.seed).toBe(firstLightSeed)
      expect(settings.parametersBySeed['drifting-filaments']).toEqual({
        filamentCount: 160,
        noiseScale: 0.0014,
        stepLength: 1.4,
      })
    }
  })

  it('falls back to the default seed when the stored seed no longer exists', () => {
    const storage = memoryStorage(JSON.stringify({ seedId: 'removed-seed', parameters: {} }))
    expect(loadSettings(seeds, firstLightSeed, storage).seed).toBe(firstLightSeed)
  })

  it('does not throw when saving fails', () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }

    expect(() =>
      saveSettings({ seed: firstLightSeed, parametersBySeed: {} }, failing),
    ).not.toThrow()
  })
})
