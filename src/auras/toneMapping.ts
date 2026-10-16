import type { RuntimeKind } from '../seeds/types'

export type ToneMappingId =
  | 'none'
  | 'linear'
  | 'reinhard'
  | 'cineon'
  | 'aces-filmic'
  | 'agx'
  | 'neutral'

export const toneMappingOptions: readonly { id: ToneMappingId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'linear', label: 'Linear' },
  { id: 'reinhard', label: 'Reinhard' },
  { id: 'cineon', label: 'Cineon' },
  { id: 'aces-filmic', label: 'ACES Filmic' },
  { id: 'agx', label: 'AgX' },
  { id: 'neutral', label: 'Neutral' },
]

const toneMappingIds: ReadonlySet<string> = new Set(toneMappingOptions.map(({ id }) => id))

export function isToneMappingId(value: unknown): value is ToneMappingId {
  return typeof value === 'string' && toneMappingIds.has(value)
}

export function isToneMappingCompatible(
  toneMappingId: unknown,
  runtime: RuntimeKind,
): toneMappingId is ToneMappingId {
  return runtime === 'three' && isToneMappingId(toneMappingId)
}
