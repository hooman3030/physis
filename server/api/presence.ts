import type { Archive, CodeNodeRecord, ImprintRecord, ParameterValues } from '../archive'
import type { ArtworkParameter, SeedDeclaration } from '../../src/seeds/types'
import { HttpError } from './http'

export type ControlParameter = ArtworkParameter
export type ControlModule = SeedDeclaration

export type PresenceSnapshot = {
  revision: number
  code: CodeNodeRecord | null
  imprint: ImprintRecord | null
  module: SeedDeclaration | null
  parameters: ParameterValues | null
}

type Listener = (snapshot: PresenceSnapshot) => void

export type SelectKind = 'code' | 'imprint'

function defaultsOf(module: ControlModule): ParameterValues {
  return Object.fromEntries(module.parameters.map(({ id, defaultValue }) => [id, defaultValue]))
}

// The one running artwork. The archive stores which code and Imprint it points
// to; the live parameter values exist only here until they are saved as an
// Imprint.
export class LivePresence {
  readonly #archive: Archive
  readonly #modules: ReadonlyMap<string, ControlModule>
  readonly #listeners = new Set<Listener>()
  #code: CodeNodeRecord | null = null
  #imprint: ImprintRecord | null = null
  #parameters: ParameterValues | null = null
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
    this.#parameters = imprint === null ? defaultsOf(module) : { ...imprint.parameters }
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
      code: this.#code,
      imprint: this.#imprint,
      module:
        module === undefined
          ? null
          : {
              id: module.id,
              label: module.label,
              parameters: module.parameters,
              runtime: module.runtime,
            },
      parameters: this.#parameters,
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
      this.#parameters = defaultsOf(module)
    } else {
      const imprint = this.#archive.getImprint(id)
      this.#module(imprint.codeId)
      const presence = this.#archive.selectImprint(id)
      this.#code = presence.code
      this.#imprint = presence.imprint
      this.#parameters = { ...imprint.parameters }
    }
    this.#notify()
    return this.snapshot()
  }

  // Live tweaks change only this in-memory state; nothing is archived.
  setParameters(values: Record<string, unknown>): PresenceSnapshot {
    if (this.#code === null || this.#parameters === null) {
      throw new HttpError(409, 'No artwork is selected')
    }
    const module = this.#module(this.#code.id)
    const declared = new Map(module.parameters.map((parameter) => [parameter.id, parameter]))
    const next: Record<string, number> = { ...this.#parameters }

    for (const [key, value] of Object.entries(values)) {
      const parameter = declared.get(key)
      if (parameter === undefined) throw new HttpError(400, `Unknown parameter ${key}`)
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new HttpError(400, `Parameter ${key} must be a finite number`)
      }
      if (value < parameter.min || value > parameter.max) {
        throw new HttpError(
          400,
          `Parameter ${key} must be between ${parameter.min} and ${parameter.max}`,
        )
      }
      next[key] = value
    }

    this.#parameters = next
    this.#notify()
    return this.snapshot()
  }

  // Saves the live parameters as an Imprint. The Presence keeps running and
  // advances to the new Imprint.
  saveImprint(options: {
    sourceRevision: string
    sourceDirty: boolean
    parentId?: string | null
    randomSeed?: number
  }): ImprintRecord {
    if (this.#code === null || this.#parameters === null) {
      throw new HttpError(409, 'No artwork is selected')
    }
    const imprint = this.#archive.saveImprint({
      codeId: this.#code.id,
      sourceRevision: options.sourceRevision,
      parameters: this.#parameters,
      parentId: options.parentId,
      randomSeed: options.randomSeed,
      validation: { sourceDirty: options.sourceDirty },
    })
    this.#imprint = imprint
    this.#notify()
    return imprint
  }
}
