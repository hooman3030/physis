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
export type ModuleDeclaration = {
  id: string
  parameters: readonly ParameterDeclaration[]
}

export type ParameterValues = Readonly<Record<string, number>>

// Shared core of everything in a lineage tree.
export interface LineageNode {
  id: string
  parentId: string | null
  createdAt: string
}

// A Seed is a code node that has been promoted; any other node is a Mutation.
export interface CodeNodeRecord extends LineageNode {
  role: 'seed' | 'mutation'
  sourceRevision: string
  validation: unknown
  promotedAt: string | null
}

export interface ImprintRecord extends LineageNode {
  codeId: string
  sourceRevision: string
  parameters: ParameterValues
  randomSeed: number | null
  validation: unknown
}

export type PresenceState = {
  code: CodeNodeRecord | null
  imprint: ImprintRecord | null
}

export type SaveImprintInput = {
  codeId: string
  sourceRevision: string
  parameters: ParameterValues
  randomSeed?: number | null
  validation?: unknown
  // Defaults to the Presence's Imprint when it runs the same code, otherwise
  // starts a new root; null always starts a new root.
  parentId?: string | null
}

export type ArchiveOptions = {
  path: string
  modules: readonly ModuleDeclaration[]
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
    parentId: row.parent_id as string | null,
    codeId: row.code_id as string,
    sourceRevision: row.source_revision as string,
    parameters: parseParameters(row.parameters as string, id),
    randomSeed: row.random_seed as number | null,
    validation: parseJson(row.validation as string | null, `validation of imprint ${id}`),
    createdAt: row.created_at as string,
  }
}

function toCodeNode(row: Row): CodeNodeRecord {
  const promotedAt = row.promoted_at as string | null
  return {
    id: row.id as string,
    parentId: row.parent_id as string | null,
    role: promotedAt === null ? 'mutation' : 'seed',
    sourceRevision: row.source_revision as string,
    validation: parseJson(row.validation as string | null, `validation of code node ${row.id}`),
    promotedAt,
    createdAt: row.created_at as string,
  }
}

const CODE_NODE_SELECT = `SELECT code_nodes.*, promotions.created_at AS promoted_at
  FROM code_nodes LEFT JOIN promotions ON promotions.code_id = code_nodes.id`

export class Archive {
  readonly #db: DatabaseSync
  readonly #declarations: ReadonlyMap<string, ModuleDeclaration>
  readonly #now: () => Date

  constructor(db: DatabaseSync, modules: readonly ModuleDeclaration[], now: () => Date) {
    this.#db = db
    this.#declarations = new Map(modules.map((module) => [module.id, module]))
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

  #exists(table: 'code_nodes' | 'imprints', id: string): boolean {
    return this.#one(`SELECT 1 AS found FROM ${table} WHERE id = ?`, id) !== undefined
  }

  #declaration(id: string): ModuleDeclaration {
    const declaration = this.#declarations.get(id)
    if (declaration === undefined) {
      throw invalid(`Module ${id} has no registered parameter declarations`)
    }
    return declaration
  }

  #insertCodeNode(input: {
    id: string
    parentId: string | null
    sourceRevision: string
    validation?: unknown
  }): void {
    if (this.#exists('code_nodes', input.id)) {
      throw new ArchiveError('already-exists', `Code node ${input.id} already exists`)
    }
    if (input.parentId !== null && !this.#exists('code_nodes', input.parentId)) {
      throw new ArchiveError('not-found', `Parent code node ${input.parentId} does not exist`)
    }
    this.#db
      .prepare(
        `INSERT INTO code_nodes (id, parent_id, source_revision, validation, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.parentId,
        input.sourceRevision,
        input.validation === undefined ? null : JSON.stringify(input.validation),
        this.#timestamp(),
      )
  }

  #insertPromotion(codeId: string): void {
    this.#db
      .prepare('INSERT INTO promotions (code_id, created_at) VALUES (?, ?)')
      .run(codeId, this.#timestamp())
  }

  // Registers an authored root module as a Seed.
  registerSeed(input: { id: string; sourceRevision: string }): CodeNodeRecord {
    requireName('seed', input.id)
    requireRevision(input.sourceRevision)
    this.#declaration(input.id)

    return this.#transaction(() => {
      this.#insertCodeNode({ ...input, parentId: null })
      this.#insertPromotion(input.id)
      return this.getCodeNode(input.id)
    })
  }

  // A child code revision; it stays a Mutation until promoted.
  recordMutation(input: {
    id: string
    parentId: string
    sourceRevision: string
    validation?: unknown
  }): CodeNodeRecord {
    requireName('mutation', input.id)
    requireRevision(input.sourceRevision)

    return this.#transaction(() => {
      this.#insertCodeNode(input)
      return this.getCodeNode(input.id)
    })
  }

  promoteMutation(id: string): CodeNodeRecord {
    return this.#transaction(() => {
      const node = this.getCodeNode(id)
      this.#declaration(id)
      if (node.role === 'seed') {
        throw new ArchiveError('already-exists', `Code node ${id} is already a Seed`)
      }
      this.#insertPromotion(id)
      return this.getCodeNode(id)
    })
  }

  // Saves the current parameters as a child Imprint and points the Presence at it.
  saveImprint(input: SaveImprintInput): ImprintRecord {
    requireRevision(input.sourceRevision)
    const randomSeed = input.randomSeed ?? null
    if (randomSeed !== null && !Number.isSafeInteger(randomSeed)) {
      throw invalid('Random seed must be a safe integer')
    }

    return this.#transaction(() => {
      this.getCodeNode(input.codeId)
      validateParameters(this.#declaration(input.codeId), input.parameters)

      const presence = this.getPresence()
      const parentId =
        input.parentId === undefined
          ? presence.code?.id === input.codeId
            ? (presence.imprint?.id ?? null)
            : null
          : input.parentId
      if (parentId !== null) {
        const parent = this.getImprint(parentId)
        if (parent.codeId !== input.codeId) {
          throw invalid(`Parent imprint ${parentId} belongs to a different code node`)
        }
      }

      const id = randomUUID()
      this.#db
        .prepare(
          `INSERT INTO imprints
             (id, parent_id, code_id, source_revision, parameters, random_seed,
              validation, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          parentId,
          input.codeId,
          input.sourceRevision,
          JSON.stringify(input.parameters),
          randomSeed,
          input.validation === undefined ? null : JSON.stringify(input.validation),
          this.#timestamp(),
        )
      this.#db
        .prepare('UPDATE presence SET code_id = ?, imprint_id = ? WHERE id = 1')
        .run(input.codeId, id)
      return this.getImprint(id)
    })
  }

  getCodeNode(id: string): CodeNodeRecord {
    const row = this.#one(`${CODE_NODE_SELECT} WHERE code_nodes.id = ?`, id)
    if (row === undefined) throw new ArchiveError('not-found', `Code node ${id} does not exist`)
    return toCodeNode(row)
  }

  getImprint(id: string): ImprintRecord {
    const row = this.#one('SELECT * FROM imprints WHERE id = ?', id)
    if (row === undefined) throw new ArchiveError('not-found', `Imprint ${id} does not exist`)
    return toImprint(row)
  }

  deleteImprint(id: string): void {
    this.#transaction(() => {
      const imprint = this.getImprint(id)
      if (this.getPresence().imprint?.id === id) {
        throw new ArchiveError('conflict', 'The active Imprint cannot be deleted')
      }

      this.#db
        .prepare('UPDATE imprints SET parent_id = ? WHERE parent_id = ?')
        .run(imprint.parentId, id)
      this.#db.prepare('DELETE FROM imprints WHERE id = ?').run(id)
    })
  }

  listCodeNodes(role?: CodeNodeRecord['role']): CodeNodeRecord[] {
    const filter =
      role === undefined
        ? ''
        : role === 'seed'
          ? 'WHERE promotions.code_id IS NOT NULL'
          : 'WHERE promotions.code_id IS NULL'
    const rows = this.#db
      .prepare(`${CODE_NODE_SELECT} ${filter} ORDER BY code_nodes.created_at, code_nodes.id`)
      .all() as Row[]
    return rows.map(toCodeNode)
  }

  listImprints(codeId?: string): ImprintRecord[] {
    const rows = (
      codeId === undefined
        ? this.#db.prepare('SELECT * FROM imprints ORDER BY created_at, id').all()
        : this.#db
            .prepare('SELECT * FROM imprints WHERE code_id = ? ORDER BY created_at, id')
            .all(codeId)
    ) as Row[]
    return rows.map(toImprint)
  }

  // Root-first chain from the lineage root to the given node.
  getCodeAncestry(id: string): CodeNodeRecord[] {
    this.getCodeNode(id)
    return this.#ancestry('code_nodes', id).map((nodeId) => this.getCodeNode(nodeId))
  }

  getImprintAncestry(id: string): ImprintRecord[] {
    this.getImprint(id)
    return this.#ancestry('imprints', id).map((nodeId) => this.getImprint(nodeId))
  }

  #ancestry(table: 'code_nodes' | 'imprints', id: string): string[] {
    const rows = this.#db
      .prepare(
        `WITH RECURSIVE chain(id, depth) AS (
           SELECT id, 0 FROM ${table} WHERE id = ?
           UNION ALL
           SELECT n.parent_id, chain.depth + 1
           FROM ${table} n JOIN chain ON n.id = chain.id
           WHERE n.parent_id IS NOT NULL
         )
         SELECT id FROM chain ORDER BY depth DESC`,
      )
      .all(id) as Row[]
    return rows.map((row) => row.id as string)
  }

  getPresence(): PresenceState {
    const row = this.#one('SELECT code_id, imprint_id FROM presence WHERE id = 1')
    const codeId = (row?.code_id ?? null) as string | null
    const imprintId = (row?.imprint_id ?? null) as string | null
    return {
      code: codeId === null ? null : this.getCodeNode(codeId),
      imprint: imprintId === null ? null : this.getImprint(imprintId),
    }
  }

  // Selecting anything from the archive only moves the pointer; nothing is written
  // to the immutable tables. A code node starts at its default parameters.
  selectCode(id: string): PresenceState {
    return this.#transaction(() => {
      this.getCodeNode(id)
      this.#db.prepare('UPDATE presence SET code_id = ?, imprint_id = NULL WHERE id = 1').run(id)
      return this.getPresence()
    })
  }

  selectImprint(id: string): PresenceState {
    return this.#transaction(() => {
      const imprint = this.getImprint(id)
      this.#db
        .prepare('UPDATE presence SET code_id = ?, imprint_id = ? WHERE id = 1')
        .run(imprint.codeId, id)
      return this.getPresence()
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

function validateParameters(declaration: ModuleDeclaration, values: ParameterValues): void {
  const declared = new Set(declaration.parameters.map(({ id }) => id))
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) throw invalid(`Unknown parameter ${key} for ${declaration.id}`)
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
    return new Archive(db, options.modules, options.now ?? (() => new Date()))
  } catch (error) {
    db.close()
    throw error
  }
}
