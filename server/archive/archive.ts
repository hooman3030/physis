import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite'
import { ArchiveError } from './errors'
import { migrate } from './migrations'

export type ParameterDeclaration = {
  id: string
  min: number
  max: number
}

// Structurally compatible with the browser's ArtworkSeed declarations.
export type SeedDeclaration = {
  id: string
  parameters: readonly ParameterDeclaration[]
}

export type ParameterValues = Readonly<Record<string, number>>

export type SeedRecord = {
  id: string
  sourceRevision: string
  promotedFromMutationId: string | null
  createdAt: string
}

export type MutationParent = { kind: 'seed' | 'mutation'; id: string }

export type MutationRecord = {
  id: string
  parent: MutationParent
  sourceRevision: string
  validation: unknown
  createdAt: string
}

export type ImprintRecord = {
  id: string
  parentImprintId: string | null
  seedId: string
  sourceRevision: string
  parameters: ParameterValues
  randomSeed: number | null
  validation: unknown
  createdAt: string
}

export type SaveImprintInput = {
  seedId: string
  sourceRevision: string
  parameters: ParameterValues
  randomSeed?: number | null
  validation?: unknown
  // Defaults to the active Imprint; null starts a new root lineage.
  parentImprintId?: string | null
}

export type ArchiveOptions = {
  path: string
  seeds: readonly SeedDeclaration[]
  now?: () => Date
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const REVISION_PATTERN = /^[0-9a-f]{7,64}$/i

type Row = Record<string, unknown>

function invalid(message: string): ArchiveError {
  return new ArchiveError('invalid-input', message)
}

function requireName(kind: string, value: string): void {
  if (!NAME_PATTERN.test(value)) throw invalid(`Invalid ${kind} ID: ${JSON.stringify(value)}`)
}

function requireRevision(value: string): void {
  if (!REVISION_PATTERN.test(value)) {
    throw invalid(`Source revision must be a hexadecimal commit hash: ${JSON.stringify(value)}`)
  }
}

function parseJson(text: string | null, what: string): unknown {
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new ArchiveError('corrupt', `Stored ${what} is not valid JSON`)
  }
}

function parseParameters(text: string, imprintId: string): ParameterValues {
  const value = parseJson(text, `parameters of imprint ${imprintId}`)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ArchiveError('corrupt', `Parameters of imprint ${imprintId} are not an object`)
  }
  return value as ParameterValues
}

function toImprint(row: Row): ImprintRecord {
  const id = row.id as string
  return {
    id,
    parentImprintId: row.parent_imprint_id as string | null,
    seedId: row.seed_id as string,
    sourceRevision: row.source_revision as string,
    parameters: parseParameters(row.parameters as string, id),
    randomSeed: row.random_seed as number | null,
    validation: parseJson(row.validation as string | null, `validation of imprint ${id}`),
    createdAt: row.created_at as string,
  }
}

function toMutation(row: Row): MutationRecord {
  const parent: MutationParent =
    row.parent_seed_id === null
      ? { kind: 'mutation', id: row.parent_mutation_id as string }
      : { kind: 'seed', id: row.parent_seed_id as string }
  return {
    id: row.id as string,
    parent,
    sourceRevision: row.source_revision as string,
    validation: parseJson(row.validation as string | null, `validation of mutation ${row.id}`),
    createdAt: row.created_at as string,
  }
}

function toSeed(row: Row): SeedRecord {
  return {
    id: row.id as string,
    sourceRevision: row.source_revision as string,
    promotedFromMutationId: row.promoted_from_mutation_id as string | null,
    createdAt: row.created_at as string,
  }
}

export class Archive {
  readonly #db: DatabaseSync
  readonly #declarations: ReadonlyMap<string, SeedDeclaration>
  readonly #now: () => Date

  constructor(db: DatabaseSync, seeds: readonly SeedDeclaration[], now: () => Date) {
    this.#db = db
    this.#declarations = new Map(seeds.map((seed) => [seed.id, seed]))
    this.#now = now
  }

  close(): void {
    this.#db.close()
  }

  #transaction<T>(work: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE')
    try {
      const result = work()
      this.#db.exec('COMMIT')
      return result
    } catch (error) {
      this.#db.exec('ROLLBACK')
      throw error
    }
  }

  #timestamp(): string {
    return this.#now().toISOString()
  }

  #one(sql: string, ...params: string[]): Row | undefined {
    return this.#db.prepare(sql).get(...params) as Row | undefined
  }

  #exists(table: 'seeds' | 'mutations' | 'imprints', id: string): boolean {
    return this.#one(`SELECT 1 AS found FROM ${table} WHERE id = ?`, id) !== undefined
  }

  registerSeed(input: { id: string; sourceRevision: string }): SeedRecord {
    requireName('seed', input.id)
    requireRevision(input.sourceRevision)
    if (!this.#declarations.has(input.id)) {
      throw invalid(`Seed ${input.id} has no registered parameter declarations`)
    }

    return this.#transaction(() => {
      if (this.#exists('seeds', input.id)) {
        throw new ArchiveError('already-exists', `Seed ${input.id} is already registered`)
      }
      this.#db
        .prepare('INSERT INTO seeds (id, source_revision, created_at) VALUES (?, ?, ?)')
        .run(input.id, input.sourceRevision, this.#timestamp())
      return this.getSeed(input.id)
    })
  }

  recordMutation(input: {
    id: string
    parent: MutationParent
    sourceRevision: string
    validation?: unknown
  }): MutationRecord {
    requireName('mutation', input.id)
    requireRevision(input.sourceRevision)

    return this.#transaction(() => {
      if (this.#exists('mutations', input.id)) {
        throw new ArchiveError('already-exists', `Mutation ${input.id} already exists`)
      }
      const parentTable = input.parent.kind === 'seed' ? 'seeds' : 'mutations'
      if (!this.#exists(parentTable, input.parent.id)) {
        throw new ArchiveError(
          'not-found',
          `Parent ${input.parent.kind} ${input.parent.id} does not exist`,
        )
      }
      this.#db
        .prepare(
          `INSERT INTO mutations
             (id, parent_seed_id, parent_mutation_id, source_revision, validation, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.parent.kind === 'seed' ? input.parent.id : null,
          input.parent.kind === 'mutation' ? input.parent.id : null,
          input.sourceRevision,
          input.validation === undefined ? null : JSON.stringify(input.validation),
          this.#timestamp(),
        )
      return this.getMutation(input.id)
    })
  }

  // A promoted Mutation becomes a Seed with the same module ID.
  promoteMutation(mutationId: string): SeedRecord {
    return this.#transaction(() => {
      const mutation = this.getMutation(mutationId)
      if (!this.#declarations.has(mutationId)) {
        throw invalid(`Mutation ${mutationId} has no registered parameter declarations`)
      }
      if (this.#exists('seeds', mutationId)) {
        throw new ArchiveError('already-exists', `Seed ${mutationId} is already registered`)
      }
      this.#db
        .prepare(
          `INSERT INTO seeds (id, source_revision, promoted_from_mutation_id, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(mutationId, mutation.sourceRevision, mutationId, this.#timestamp())
      return this.getSeed(mutationId)
    })
  }

  saveImprint(input: SaveImprintInput): ImprintRecord {
    requireRevision(input.sourceRevision)
    const randomSeed = input.randomSeed ?? null
    if (randomSeed !== null && !Number.isSafeInteger(randomSeed)) {
      throw invalid('Random seed must be a safe integer')
    }

    return this.#transaction(() => {
      if (!this.#exists('seeds', input.seedId)) {
        throw new ArchiveError('not-found', `Seed ${input.seedId} is not registered`)
      }
      const declaration = this.#declarations.get(input.seedId)
      if (declaration === undefined) {
        throw invalid(`Seed ${input.seedId} has no registered parameter declarations`)
      }
      validateParameters(declaration, input.parameters)

      const parentImprintId =
        input.parentImprintId === undefined
          ? (this.getActiveImprint()?.id ?? null)
          : input.parentImprintId
      if (parentImprintId !== null && !this.#exists('imprints', parentImprintId)) {
        throw new ArchiveError('not-found', `Parent imprint ${parentImprintId} does not exist`)
      }

      const id = randomUUID()
      this.#db
        .prepare(
          `INSERT INTO imprints
             (id, parent_imprint_id, seed_id, source_revision, parameters, random_seed,
              validation, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          parentImprintId,
          input.seedId,
          input.sourceRevision,
          JSON.stringify(input.parameters),
          randomSeed,
          input.validation === undefined ? null : JSON.stringify(input.validation),
          this.#timestamp(),
        )
      this.#db.prepare('UPDATE presence SET active_imprint_id = ? WHERE id = 1').run(id)
      return this.getImprint(id)
    })
  }

  getSeed(id: string): SeedRecord {
    const row = this.#one('SELECT * FROM seeds WHERE id = ?', id)
    if (row === undefined) throw new ArchiveError('not-found', `Seed ${id} does not exist`)
    return toSeed(row)
  }

  getMutation(id: string): MutationRecord {
    const row = this.#one('SELECT * FROM mutations WHERE id = ?', id)
    if (row === undefined) throw new ArchiveError('not-found', `Mutation ${id} does not exist`)
    return toMutation(row)
  }

  getImprint(id: string): ImprintRecord {
    const row = this.#one('SELECT * FROM imprints WHERE id = ?', id)
    if (row === undefined) throw new ArchiveError('not-found', `Imprint ${id} does not exist`)
    return toImprint(row)
  }

  listSeeds(): SeedRecord[] {
    return (this.#db.prepare('SELECT * FROM seeds ORDER BY created_at, id').all() as Row[]).map(
      toSeed,
    )
  }

  // Root-first chain of Imprints ending at the given Imprint.
  getImprintAncestry(id: string): ImprintRecord[] {
    this.getImprint(id)
    const rows = this.#db
      .prepare(
        `WITH RECURSIVE chain(id, depth) AS (
           SELECT id, 0 FROM imprints WHERE id = ?
           UNION ALL
           SELECT i.parent_imprint_id, chain.depth + 1
           FROM imprints i JOIN chain ON i.id = chain.id
           WHERE i.parent_imprint_id IS NOT NULL
         )
         SELECT imprints.* FROM chain JOIN imprints ON imprints.id = chain.id
         ORDER BY chain.depth DESC`,
      )
      .all(id) as Row[]
    return rows.map(toImprint)
  }

  getActiveImprint(): ImprintRecord | null {
    const row = this.#one(
      `SELECT imprints.* FROM presence JOIN imprints ON imprints.id = presence.active_imprint_id
       WHERE presence.id = 1`,
    )
    return row === undefined ? null : toImprint(row)
  }

  setActiveImprint(id: string): ImprintRecord {
    return this.#transaction(() => {
      const imprint = this.getImprint(id)
      this.#db.prepare('UPDATE presence SET active_imprint_id = ? WHERE id = 1').run(id)
      return imprint
    })
  }

  // Returns a list of problems; an empty list means the archive is consistent.
  verify(): string[] {
    const problems: string[] = []
    for (const row of this.#db.prepare('PRAGMA integrity_check').all() as Row[]) {
      if (row.integrity_check !== 'ok') problems.push(`integrity: ${row.integrity_check}`)
    }
    for (const row of this.#db.prepare('PRAGMA foreign_key_check').all() as Row[]) {
      problems.push(`foreign key: ${row.table} row ${row.rowid} references missing ${row.parent}`)
    }
    for (const row of this.#db.prepare('SELECT id, parameters FROM imprints').all() as Row[]) {
      try {
        parseParameters(row.parameters as string, row.id as string)
      } catch (error) {
        problems.push((error as Error).message)
      }
    }
    return problems
  }

  // Writes a consistent copy using SQLite's online backup; never overwrites.
  async backup(destination: string): Promise<void> {
    if (existsSync(destination)) {
      throw invalid(`Backup destination already exists: ${destination}`)
    }
    await sqliteBackup(this.#db, destination)
  }
}

function validateParameters(declaration: SeedDeclaration, values: ParameterValues): void {
  const declared = new Set(declaration.parameters.map(({ id }) => id))
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) throw invalid(`Unknown parameter ${key} for seed ${declaration.id}`)
  }
  for (const { id, min, max } of declaration.parameters) {
    const value = values[id]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalid(`Parameter ${id} must be a finite number`)
    }
    if (value < min || value > max) {
      throw invalid(`Parameter ${id} must be between ${min} and ${max}`)
    }
  }
}

export function openArchive(options: ArchiveOptions): Archive {
  const db = new DatabaseSync(options.path)
  try {
    db.exec('PRAGMA foreign_keys = ON')
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = FULL')
    migrate(db)
    return new Archive(db, options.seeds, options.now ?? (() => new Date()))
  } catch (error) {
    db.close()
    throw error
  }
}
