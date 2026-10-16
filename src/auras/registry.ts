import type { RuntimeKind } from '../seeds/types'
import type { AuraId, AuraPreset } from './types'

export const auraPresets: readonly AuraPreset[] = [
  {
    id: 'off',
    label: 'Off',
    runtime: 'three',
    effects: {},
  },
  {
    id: 'soft-bloom',
    label: 'Soft bloom',
    runtime: 'three',
    effects: {
      bloom: { strength: 0.6, radius: 0.35, threshold: 0.45 },
      vignette: { strength: 0.18, radius: 0.72 },
    },
  },
  {
    id: 'warm-film',
    label: 'Warm film',
    runtime: 'three',
    effects: {
      colorGrade: { saturation: 0.86, contrast: 1.06, tint: '#fff0d5' },
      filmGrain: { intensity: 0.12 },
      vignette: { strength: 0.2, radius: 0.68 },
    },
  },
  {
    id: 'prismatic',
    label: 'Prismatic',
    runtime: 'three',
    effects: {
      bloom: { strength: 0.35, radius: 0.2, threshold: 0.55 },
      colorGrade: { saturation: 1.12, contrast: 1.03, tint: '#e5eeff' },
      chromaticAberration: { strength: 0.35, scale: 1.1 },
    },
  },
  {
    id: 'vhs',
    label: 'VHS',
    runtime: 'three',
    effects: {
      colorGrade: { saturation: 0.78, contrast: 1.08, tint: '#f1e4c9' },
      filmGrain: { intensity: 0.88 },
      vignette: { strength: 0.28, radius: 0.74 },
      chromaticAberration: { strength: 0.32, scale: 0.55 },
      scanlines: { strength: 0.24, spacing: 3.2 },
      signalWarp: { amplitude: 1.1, frequency: 4.5 },
    },
  },
  {
    id: 'dream-haze',
    label: 'Dream haze',
    runtime: 'three',
    effects: {
      bloom: { strength: 0.82, radius: 0.55, threshold: 0.32 },
      colorGrade: { saturation: 1.04, contrast: 0.9, tint: '#e8e5ff' },
      vignette: { strength: 0.3, radius: 0.84 },
      filmGrain: { intensity: 0.48 },
    },
  },
  {
    id: 'noir',
    label: 'Noir',
    runtime: 'three',
    effects: {
      colorGrade: { saturation: 0.07, contrast: 1.22, tint: '#eeeeee' },
      filmGrain: { intensity: 0.48 },
      vignette: { strength: 0.34, radius: 0.76 },
    },
  },
  {
    id: 'crt',
    label: 'CRT signal',
    runtime: 'three',
    effects: {
      bloom: { strength: 0.22, radius: 0.16, threshold: 0.72 },
      vignette: { strength: 0.18, radius: 0.82 },
      chromaticAberration: { strength: 0.18, scale: 0.82 },
      scanlines: { strength: 0.32, spacing: 2.7 },
      signalWarp: { amplitude: 0.75, frequency: 7 },
    },
  },
  {
    id: 'halftone',
    label: 'Halftone',
    runtime: 'three',
    effects: {
      colorGrade: { saturation: 0.25, contrast: 1.12, tint: '#fff4df' },
      dotScreen: { angle: 0.72, scale: 1.15 },
      vignette: { strength: 0.12, radius: 0.88 },
    },
  },
  {
    id: 'mosaic',
    label: 'Mosaic',
    runtime: 'three',
    effects: {
      colorGrade: { saturation: 1.08, contrast: 1.06, tint: '#ffffff' },
      pixelation: { pixelSize: 8 },
    },
  },
]

const auraPresetIds: ReadonlySet<string> = new Set(auraPresets.map(({ id }) => id))

export function isAuraId(value: unknown): value is AuraId {
  return typeof value === 'string' && auraPresetIds.has(value)
}

export function isAuraCompatible(auraId: AuraId, runtime: RuntimeKind): boolean {
  return runtime === 'three' && auraPresets.some((preset) => preset.id === auraId)
}

export function getAuraPreset(auraId: AuraId): AuraPreset {
  const preset = auraPresets.find((candidate) => candidate.id === auraId)
  if (preset === undefined) throw new Error(`Aura preset "${auraId}" is not registered`)
  return preset
}
