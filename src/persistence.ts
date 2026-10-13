import type { ArtworkParameterValues, ArtworkSeed } from './seeds/types'

const STORAGE_KEY = 'physis:settings:v1'

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

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

function getBrowserStorage(): SettingsStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadSettings(
  seeds: readonly ArtworkSeed[],
  defaultSeed: ArtworkSeed,
  storage: SettingsStorage | null = getBrowserStorage(),
): ArtworkSettings {
  let stored: unknown
  try {
    const text = storage?.getItem(STORAGE_KEY)
    stored = text ? JSON.parse(text) : undefined
  } catch {
    stored = undefined
  }

  const record =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
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
  storage: SettingsStorage | null = getBrowserStorage(),
): void {
  try {
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ seedId: settings.seed.id, parameters: settings.parametersBySeed }),
    )
  } catch {
    // Persistence is optional; the artwork must keep working without it.
  }
}
