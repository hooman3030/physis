import type { ArtworkGeneValues, SeedDeclaration } from './seeds/types'

const STORAGE_KEY = 'physis:settings:v1'

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>
type ErrorReporter = (message: string) => void

export type ArtworkSettings<TSeed extends SeedDeclaration = SeedDeclaration> = {
  seed: TSeed
  genesBySeed: Readonly<Record<string, ArtworkGeneValues>>
}

export function getDefaultGeneValues(seed: SeedDeclaration): ArtworkGeneValues {
  return Object.fromEntries(seed.genes.map(({ id, defaultValue }) => [id, defaultValue]))
}

// Stored values may be stale or hand-edited, so every value is re-validated
// against the Seed's current Gene declarations.
export function sanitizeGeneValues(seed: SeedDeclaration, raw: unknown): ArtworkGeneValues {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  return Object.fromEntries(
    seed.genes.map(({ id, defaultValue, min, max, step }) => {
      const value = stored[id]
      if (typeof value !== 'number' || !Number.isFinite(value)) return [id, defaultValue]

      const snapped = min + Math.round((value - min) / step) * step
      return [id, Number(Math.min(max, Math.max(min, snapped)).toFixed(6))]
    }),
  )
}

function getBrowserStorage(reportError: ErrorReporter): SettingsStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    reportError(`Browser storage is unavailable: ${errorMessage(error)}`)
    return null
  }
}

export function loadSettings<TSeed extends SeedDeclaration>(
  seeds: readonly TSeed[],
  defaultSeed: TSeed,
  reportError: ErrorReporter,
  storage: SettingsStorage | null = getBrowserStorage(reportError),
): ArtworkSettings<TSeed> {
  let stored: unknown
  let text: string | null = null
  try {
    text = storage?.getItem(STORAGE_KEY) ?? null
  } catch (error) {
    reportError(`Could not read saved artwork settings: ${errorMessage(error)}`)
  }

  if (text !== null && text !== '') {
    try {
      stored = JSON.parse(text)
    } catch (error) {
      reportError(`Saved artwork settings could not be parsed: ${errorMessage(error)}`)
    }
  }

  if (
    stored !== undefined &&
    (typeof stored !== 'object' || stored === null || Array.isArray(stored))
  ) {
    reportError('Saved artwork settings have an invalid format; defaults will be used.')
    stored = undefined
  }

  const record = stored === undefined ? {} : (stored as Record<string, unknown>)
  const storedGenes =
    typeof record.genes === 'object' && record.genes !== null
      ? (record.genes as Record<string, unknown>)
      : typeof record.parameters === 'object' && record.parameters !== null
        ? (record.parameters as Record<string, unknown>)
        : {}

  return {
    seed: seeds.find((candidate) => candidate.id === record.seedId) ?? defaultSeed,
    genesBySeed: Object.fromEntries(
      seeds.map((seed) => [seed.id, sanitizeGeneValues(seed, storedGenes[seed.id])]),
    ),
  }
}

export function saveSettings(
  settings: ArtworkSettings,
  reportError: ErrorReporter,
  storage: SettingsStorage | null = getBrowserStorage(reportError),
): void {
  try {
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ seedId: settings.seed.id, genes: settings.genesBySeed }),
    )
  } catch (error) {
    reportError(`Could not save artwork settings: ${errorMessage(error)}`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
