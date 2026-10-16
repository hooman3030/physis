export type AuraId =
  | 'off'
  | 'soft-bloom'
  | 'warm-film'
  | 'prismatic'
  | 'vhs'
  | 'dream-haze'
  | 'noir'
  | 'crt'
  | 'halftone'
  | 'mosaic'

export type AuraEffects = {
  bloom?: {
    strength: number
    radius: number
    threshold: number
  }
  vignette?: {
    strength: number
    radius: number
  }
  colorGrade?: {
    saturation: number
    contrast: number
    tint: string
  }
  filmGrain?: {
    intensity: number
  }
  chromaticAberration?: {
    strength: number
    scale: number
  }
  scanlines?: {
    strength: number
    spacing: number
  }
  signalWarp?: {
    amplitude: number
    frequency: number
  }
  dotScreen?: {
    angle: number
    scale: number
  }
  pixelation?: {
    pixelSize: number
  }
}

export type AuraPreset = {
  id: AuraId
  label: string
  runtime: 'three'
  effects: AuraEffects
}
