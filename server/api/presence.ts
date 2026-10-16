import type { Archive, CodeNodeRecord, GeneValues, ImprintRecord } from '../archive'
import type { ArtworkGene, SeedDeclaration } from '../../src/seeds/types'
import { isAuraCompatible, isAuraId } from '../../src/auras/registry'
import type { AuraId } from '../../src/auras/types'
import { isToneMappingCompatible, isToneMappingId } from '../../src/auras/toneMapping'
import type { ToneMappingId } from '../../src/auras/toneMapping'
import { DEFAULT_PLAYBACK_SPEED, isPlaybackSpeed } from '../../src/playbackClock'
import { HttpError } from './http'

export type ControlGene = ArtworkGene
export type ControlModule = SeedDeclaration

export type PresenceSnapshot = {
  revision: number
  paused: boolean
  speed: number
  auraId: AuraId | null
  toneMappingId: ToneMappingId | null
  code: CodeNodeRecord | null
  imprint: ImprintRecord | null
  module: SeedDeclaration | null
  genes: GeneValues | null
}

type Listener = (snapshot: PresenceSnapshot) => void

export type SelectKind = 'code' | 'imprint'

function defaultsOf(module: ControlModule): GeneValues {
  return Object.fromEntries(module.genes.map(({ id, defaultValue }) => [id, defaultValue]))
}

function auraOf(module: ControlModule, imprintAuraId: AuraId | null): AuraId | null {
  if (module.runtime !== 'three') return null
  return imprintAuraId ?? module.defaultAuraId ?? 'off'
}

function toneMappingOf(
  module: ControlModule,
  imprintToneMappingId: ToneMappingId | null,
): ToneMappingId | null {
  if (module.runtime !== 'three') return null
  return imprintToneMappingId ?? 'none'
}

// The one running artwork. The archive stores which code and Imprint it points
// to; the live Gene values exist only here until they are saved as an
// Imprint.
export class LivePresence {
  readonly #archive: Archive
  readonly #modules: ReadonlyMap<string, ControlModule>
  readonly #listeners = new Set<Listener>()
  #code: CodeNodeRecord | null = null
  #imprint: ImprintRecord | null = null
  #genes: GeneValues | null = null
  #paused = false
  #speed = DEFAULT_PLAYBACK_SPEED
  #auraId: AuraId | null = null
  #toneMappingId: ToneMappingId | null = null
  #revision = 0

  constructor(archive: Archive, modules: readonly ControlModule[]) {
    this.#archive = archive
    this.#modules = new Map(modules.map((module) => [module.id, module]))
    this.#restore()
  }

  // A pointer to code this build no longer has leaves the Presence empty rather
  // than failing, so the service still starts.
  #restore(): void {
    const { code, imprint } = this.#archive.getPresence()
    const module = code === null ? undefined : this.#modules.get(code.id)
    if (code === null || module === undefined) return
    this.#code = code
    this.#imprint = imprint
    this.#genes = imprint === null ? defaultsOf(module) : { ...imprint.genes }
    this.#auraId = auraOf(module, imprint?.auraId ?? null)
    this.#toneMappingId = toneMappingOf(module, imprint?.toneMappingId ?? null)
  }

  #module(id: string): ControlModule {
    const module = this.#modules.get(id)
    if (module === undefined) {
      throw new HttpError(400, `Artwork module ${id} is not available in this build`)
    }
    return module
  }

  #notify(): void {
    this.#revision += 1
    const snapshot = this.snapshot()
    for (const listener of this.#listeners) listener(snapshot)
  }

  snapshot(): PresenceSnapshot {
    const module = this.#code === null ? undefined : this.#modules.get(this.#code.id)
    return {
      revision: this.#revision,
      paused: this.#paused,
      speed: this.#speed,
      auraId: this.#auraId,
      toneMappingId: this.#toneMappingId,
      code: this.#code,
      imprint: this.#imprint,
      module:
        module === undefined
          ? null
          : {
              id: module.id,
              label: module.label,
              genes: module.genes,
              runtime: module.runtime,
              defaultAuraId: module.defaultAuraId,
            },
      genes: this.#genes,
    }
  }

  hasModule(id: string): boolean {
    return this.#modules.has(id)
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  // Starts a Presence from any Seed, Mutation, or Imprint in the archive.
  select(kind: SelectKind, id: string): PresenceSnapshot {
    if (kind === 'code') {
      const module = this.#module(id)
      const { code } = this.#archive.selectCode(id)
      this.#code = code
      this.#imprint = null
      this.#genes = defaultsOf(module)
      this.#auraId = auraOf(module, null)
      this.#toneMappingId = toneMappingOf(module, null)
    } else {
      const imprint = this.#archive.getImprint(id)
      this.#module(imprint.codeId)
      const presence = this.#archive.selectImprint(id)
      this.#code = presence.code
      this.#imprint = presence.imprint
      this.#genes = { ...imprint.genes }
      this.#auraId = auraOf(this.#module(imprint.codeId), imprint.auraId)
      this.#toneMappingId = toneMappingOf(this.#module(imprint.codeId), imprint.toneMappingId)
    }
    this.#paused = false
    this.#speed = DEFAULT_PLAYBACK_SPEED
    this.#notify()
    return this.snapshot()
  }

  setPaused(paused: boolean): PresenceSnapshot {
    if (this.#code === null) throw new HttpError(409, 'No artwork is selected')
    if (this.#paused === paused) return this.snapshot()
    this.#paused = paused
    this.#notify()
    return this.snapshot()
  }

  setSpeed(speed: number): PresenceSnapshot {
    if (this.#code === null) throw new HttpError(409, 'No artwork is selected')
    if (!isPlaybackSpeed(speed)) {
      throw new HttpError(400, 'Playback speed must be between 0.1 and 4')
    }
    if (this.#speed === speed) return this.snapshot()
    this.#speed = speed
    this.#notify()
    return this.snapshot()
  }

  setAura(auraId: AuraId): PresenceSnapshot {
    if (this.#code === null) throw new HttpError(409, 'No artwork is selected')
    const module = this.#module(this.#code.id)
    if (!isAuraId(auraId)) {
      throw new HttpError(400, `Aura ${String(auraId)} is not registered`)
    }
    if (!isAuraCompatible(auraId, module.runtime)) {
      throw new HttpError(400, `Aura ${auraId} is incompatible with ${module.id}`)
    }
    if (this.#auraId === auraId) return this.snapshot()
    this.#auraId = auraId
    this.#notify()
    return this.snapshot()
  }

  setToneMapping(toneMappingId: ToneMappingId): PresenceSnapshot {
    if (this.#code === null) throw new HttpError(409, 'No artwork is selected')
    const module = this.#module(this.#code.id)
    if (!isToneMappingId(toneMappingId)) {
      throw new HttpError(400, `Tone mapping ${String(toneMappingId)} is not registered`)
    }
    if (!isToneMappingCompatible(toneMappingId, module.runtime)) {
      throw new HttpError(400, `Tone mapping ${toneMappingId} is incompatible with ${module.id}`)
    }
    if (this.#toneMappingId === toneMappingId) return this.snapshot()
    this.#toneMappingId = toneMappingId
    this.#notify()
    return this.snapshot()
  }

  // Live tweaks change only this in-memory state; nothing is archived.
  setGenes(values: Record<string, unknown>): PresenceSnapshot {
    if (this.#code === null || this.#genes === null) {
      throw new HttpError(409, 'No artwork is selected')
    }
    const module = this.#module(this.#code.id)
    const declared = new Map(module.genes.map((gene) => [gene.id, gene]))
    const next: Record<string, number> = { ...this.#genes }

    for (const [key, value] of Object.entries(values)) {
      const gene = declared.get(key)
      if (gene === undefined) throw new HttpError(400, `Unknown Gene ${key}`)
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new HttpError(400, `Gene ${key} must be a finite number`)
      }
      if (value < gene.min || value > gene.max) {
        throw new HttpError(400, `Gene ${key} must be between ${gene.min} and ${gene.max}`)
      }
      next[key] = value
    }

    this.#genes = next
    this.#notify()
    return this.snapshot()
  }

  // Saves the live Genes as an Imprint. The Presence keeps running and
  // advances to the new Imprint.
  saveImprint(options: {
    sourceRevision: string
    sourceDirty: boolean
    parentId?: string | null
    randomSeed?: number
  }): ImprintRecord {
    if (this.#code === null || this.#genes === null) {
      throw new HttpError(409, 'No artwork is selected')
    }
    const imprint = this.#archive.saveImprint({
      codeId: this.#code.id,
      sourceRevision: options.sourceRevision,
      genes: this.#genes,
      auraId: this.#auraId,
      toneMappingId: this.#toneMappingId,
      parentId: options.parentId,
      randomSeed: options.randomSeed,
      validation: { sourceDirty: options.sourceDirty },
    })
    this.#imprint = imprint
    this.#notify()
    return imprint
  }
}
