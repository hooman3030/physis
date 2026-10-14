import { reportApplicationError } from '../../errorNotifications'
import type { GraphPosition } from './lineageGraph'

const STORAGE_KEY = 'physis:lineage-layout:v1'
const MAX_COORDINATE = 100_000

type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(): LayoutStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    reportApplicationError(
      `Browser storage is unavailable for the lineage layout: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

function isGraphPosition(value: unknown): value is GraphPosition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const position = value as Record<string, unknown>
  return (
    typeof position.x === 'number' &&
    Number.isFinite(position.x) &&
    Math.abs(position.x) <= MAX_COORDINATE &&
    typeof position.y === 'number' &&
    Number.isFinite(position.y) &&
    Math.abs(position.y) <= MAX_COORDINATE
  )
}

export function readLineageLayout(
  validNodeKeys: ReadonlySet<string>,
  storage: LayoutStorage | null = getStorage(),
): Map<string, GraphPosition> {
  let text: string | null
  try {
    text = storage?.getItem(STORAGE_KEY) ?? null
  } catch (error) {
    reportApplicationError(
      `Could not read the saved lineage layout: ${error instanceof Error ? error.message : String(error)}`,
    )
    return new Map()
  }
  if (text === null || text === '') return new Map()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    reportApplicationError(
      `The saved lineage layout could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return new Map()
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    reportApplicationError('The saved lineage layout has an invalid format.')
    return new Map()
  }

  const positions = new Map<string, GraphPosition>()
  for (const [key, value] of Object.entries(parsed)) {
    if (!validNodeKeys.has(key)) continue
    if (!isGraphPosition(value)) {
      reportApplicationError(`The saved position for lineage node ${key} is invalid.`)
      continue
    }
    positions.set(key, value)
  }
  return positions
}

export function saveLineageLayout(
  positions: ReadonlyMap<string, GraphPosition>,
  storage: LayoutStorage | null = getStorage(),
): void {
  const validPositions = Object.fromEntries(
    [...positions].filter(
      ([, position]) =>
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Math.abs(position.x) <= MAX_COORDINATE &&
        Math.abs(position.y) <= MAX_COORDINATE,
    ),
  )
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(validPositions))
  } catch (error) {
    reportApplicationError(
      `Could not save the lineage layout: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function clearLineageLayout(storage: LayoutStorage | null = getStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch (error) {
    reportApplicationError(
      `Could not reset the saved lineage layout: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
