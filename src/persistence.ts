import type { ArtworkParameterValues, ArtworkSeed } from './seeds/types'

const STORAGE_KEY = 'physis:settings:v1'

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>
type ErrorReporter = (message: string) => void

export type ArtworkSettings = {
  seed: ArtworkSeed
  parametersBySeed: Readonly<Record<string, ArtworkParameterValues>>
}

export function getDefaultParameterValues(seed: ArtworkSeed): ArtworkParameterValues {
  return Object.fromEntries(seed.parameters.map(({ id, defaultValue }) => [id, defaultValue]))
}

// Stored values may be stale or hand-edited, so every value is re-validated
// against the seed's current parameter declarations.
export function sanitizeParameterValues(seed: ArtworkSeed, raw: unknown): ArtworkParameterValues {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  return Object.fromEntries(
    seed.parameters.map(({ id, defaultValue, min, max, step }) => {
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

export function loadSettings(
  seeds: readonly ArtworkSeed[],
  defaultSeed: ArtworkSeed,
  reportError: ErrorReporter,
  storage: SettingsStorage | null = getBrowserStorage(reportError),
): ArtworkSettings {
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
  const storedParameters =
    typeof record.parameters === 'object' && record.parameters !== null
      ? (record.parameters as Record<string, unknown>)
      : {}

  return {
    seed: seeds.find((candidate) => candidate.id === record.seedId) ?? defaultSeed,
    parametersBySeed: Object.fromEntries(
      seeds.map((seed) => [seed.id, sanitizeParameterValues(seed, storedParameters[seed.id])]),
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
      JSON.stringify({ seedId: settings.seed.id, parameters: settings.parametersBySeed }),
    )
  } catch (error) {
    reportError(`Could not save artwork settings: ${errorMessage(error)}`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
