import { describe, expect, it } from 'vitest'
import { loadSettings, sanitizeGeneValues, saveSettings } from '../../src/persistence'
import { driftingFilamentsSeed } from '../../src/seeds/p5/drifting-filaments/seed'
import { firstLightSeed } from '../../src/seeds/p5/first-light/seed'

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

const ignoreError = () => {}

describe('Gene sanitizing', () => {
  it('keeps valid values', () => {
    expect(
      sanitizeGeneValues(driftingFilamentsSeed, {
        filamentCount: 200,
        noiseScale: 0.002,
        stepLength: 2,
      }),
    ).toMatchObject({ filamentCount: 200, noiseScale: 0.002, stepLength: 2 })
  })

  it('clamps out-of-range values and snaps to the step', () => {
    const values = sanitizeGeneValues(driftingFilamentsSeed, {
      filamentCount: 1_000_000,
      noiseScale: 0,
      stepLength: 1.43,
    })

    const bounds = (id: string) => driftingFilamentsSeed.genes.find((p) => p.id === id)!

    expect(values.filamentCount).toBe(bounds('filamentCount').max)
    expect(values.noiseScale).toBe(bounds('noiseScale').min)
    expect(values.stepLength).toBe(1.4)
  })

  it('falls back to defaults for missing, non-numeric, and unknown values', () => {
    const values = sanitizeGeneValues(driftingFilamentsSeed, {
      filamentCount: '300',
      noiseScale: Number.NaN,
      unknown: 5,
    })

    expect(values.filamentCount).toBe(240)
    expect(values.noiseScale).toBe(0.0014)
    expect(values.stepLength).toBe(1.4)
  })
})

describe('settings storage', () => {
  it('round-trips the active seed and per-seed Genes', () => {
    const storage = memoryStorage()
    saveSettings(
      {
        seed: driftingFilamentsSeed,
        genesBySeed: {
          'first-light': {},
          'drifting-filaments': {
            filamentCount: 240,
            noiseScale: 0.003,
            stepLength: 3,
            trailLength: 50,
          },
        },
      },
      ignoreError,
      storage,
    )

    const settings = loadSettings(seeds, firstLightSeed, ignoreError, storage)
    expect(settings.seed).toBe(driftingFilamentsSeed)
    expect(settings.genesBySeed['drifting-filaments']).toMatchObject({
      filamentCount: 240,
      noiseScale: 0.003,
      stepLength: 3,
      trailLength: 50,
    })
  })

  it('uses defaults when storage is empty, corrupted, or unavailable', () => {
    for (const storage of [
      memoryStorage(),
      memoryStorage('{not json'),
      memoryStorage('42'),
      null,
    ]) {
      const settings = loadSettings(seeds, firstLightSeed, ignoreError, storage)
      expect(settings.seed).toBe(firstLightSeed)
      expect(settings.genesBySeed['drifting-filaments']).toMatchObject({
        filamentCount: 240,
        noiseScale: 0.0014,
        stepLength: 1.4,
        trailLength: 24,
      })
    }
  })

  it('migrates saved parameter values to Genes', () => {
    const storage = memoryStorage(
      JSON.stringify({
        seedId: 'drifting-filaments',
        parameters: {
          'drifting-filaments': { filamentCount: 200, hue: 180 },
        },
      }),
    )
    const settings = loadSettings(seeds, firstLightSeed, ignoreError, storage)

    expect(settings.genesBySeed['drifting-filaments']).toMatchObject({
      filamentCount: 200,
      hue: 180,
    })
    saveSettings(settings, ignoreError, storage)
    expect(JSON.parse(storage.getItem() ?? '{}')).toHaveProperty('genes')
    expect(JSON.parse(storage.getItem() ?? '{}')).not.toHaveProperty('parameters')
  })

  it('falls back to the default seed when the stored seed no longer exists', () => {
    const storage = memoryStorage(JSON.stringify({ seedId: 'removed-seed', genes: {} }))
    expect(loadSettings(seeds, firstLightSeed, ignoreError, storage).seed).toBe(firstLightSeed)
  })

  it('reports corrupt settings and continues with defaults', () => {
    const errors: string[] = []
    const settings = loadSettings(
      seeds,
      firstLightSeed,
      (message) => errors.push(message),
      memoryStorage('{not json'),
    )

    expect(settings.seed).toBe(firstLightSeed)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Saved artwork settings could not be parsed')
  })

  it('reports storage read and write failures without stopping rendering', () => {
    const errors: string[] = []
    const failing = {
      getItem: () => {
        throw new Error('read denied')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }

    expect(() =>
      loadSettings(seeds, firstLightSeed, (message) => errors.push(message), failing),
    ).not.toThrow()
    expect(() =>
      saveSettings(
        { seed: firstLightSeed, genesBySeed: {} },
        (message) => errors.push(message),
        failing,
      ),
    ).not.toThrow()
    expect(errors).toEqual([
      'Could not read saved artwork settings: read denied',
      'Could not save artwork settings: quota exceeded',
    ])
  })
})
