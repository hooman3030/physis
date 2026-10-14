import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { driftingFilamentsSeed } from '../../src/seeds/driftingFilaments'
import { firstLightSeed } from '../../src/seeds/firstLight'
import { ArchiveError, openArchive, type Archive, type SeedDeclaration } from './index'

const REV_A = 'a1b2c3d4e5f6'
const REV_B = '0123456789abcdef0123456789abcdef01234567'

const mutantDeclaration: SeedDeclaration = {
  id: 'drifting-m1',
  parameters: driftingFilamentsSeed.parameters,
}
const declarations: SeedDeclaration[] = [driftingFilamentsSeed, firstLightSeed, mutantDeclaration]

function defaults(seed: { parameters: readonly { id: string; defaultValue: number }[] }) {
  return Object.fromEntries(seed.parameters.map(({ id, defaultValue }) => [id, defaultValue]))
}

let directory: string
let archive: Archive
const open = (path = join(directory, 'archive.sqlite')) =>
  openArchive({ path, seeds: declarations })

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'physis-archive-'))
  archive = open()
  archive.registerSeed({ id: driftingFilamentsSeed.id, sourceRevision: REV_A })
})

afterEach(() => {
  archive.close()
  rmSync(directory, { recursive: true, force: true })
})

function expectCode(action: () => unknown, code: string) {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(ArchiveError)
    expect((error as ArchiveError).code).toBe(code)
    return
  }
  throw new Error(`Expected ArchiveError ${code}`)
}

describe('imprints and presence', () => {
  it('saves and retrieves an imprint and makes it active', () => {
    const saved = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters: defaults(driftingFilamentsSeed),
      randomSeed: 42,
      validation: { ok: true },
    })

    expect(saved.parentImprintId).toBeNull()
    expect(archive.getImprint(saved.id)).toEqual(saved)
    expect(archive.getActiveImprint()).toEqual(saved)
    expect(saved.randomSeed).toBe(42)
    expect(saved.validation).toEqual({ ok: true })
  })

  it('chains saves as parent/child lineage without losing ancestors', () => {
    const parameters = defaults(driftingFilamentsSeed)
    const first = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })
    const second = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })
    const third = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })

    expect(second.parentImprintId).toBe(first.id)
    expect(archive.getImprintAncestry(third.id).map(({ id }) => id)).toEqual([
      first.id,
      second.id,
      third.id,
    ])
    expect(archive.getActiveImprint()?.id).toBe(third.id)
    expect(archive.getImprint(first.id)).toEqual(first)
  })

  it('branches from an earlier imprint and keeps the original branch', () => {
    const parameters = defaults(driftingFilamentsSeed)
    const root = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })
    const left = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })
    const right = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
      parentImprintId: root.id,
    })

    expect(right.parentImprintId).toBe(root.id)
    expect(archive.getImprint(left.id).parentImprintId).toBe(root.id)
    expect(archive.getActiveImprint()?.id).toBe(right.id)
  })

  it('restores the active imprint after reopening the archive', () => {
    const saved = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters: defaults(driftingFilamentsSeed),
    })
    archive.close()
    archive = open()

    expect(archive.getActiveImprint()).toEqual(saved)
  })

  it('switches the active imprint without altering any imprint', () => {
    const parameters = defaults(driftingFilamentsSeed)
    const first = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })
    archive.saveImprint({ seedId: driftingFilamentsSeed.id, sourceRevision: REV_A, parameters })

    archive.setActiveImprint(first.id)
    expect(archive.getActiveImprint()).toEqual(first)
    expectCode(() => archive.setActiveImprint('missing'), 'not-found')
  })

  it('rejects invalid input and leaves no partial state', () => {
    const valid = defaults(driftingFilamentsSeed)
    const [firstKey] = Object.keys(valid)
    const save = (parameters: Record<string, number>, seedId = driftingFilamentsSeed.id) =>
      archive.saveImprint({ seedId, sourceRevision: REV_A, parameters })

    expectCode(() => save({ ...valid, [firstKey]: Number.NaN }), 'invalid-input')
    expectCode(() => save({ ...valid, [firstKey]: 1e9 }), 'invalid-input')
    expectCode(() => save({ ...valid, bogus: 1 }), 'invalid-input')
    expectCode(() => save({}), 'invalid-input')
    expectCode(() => save(valid, 'first-light'), 'not-found')
    expectCode(
      () =>
        archive.saveImprint({
          seedId: driftingFilamentsSeed.id,
          sourceRevision: 'nothex',
          parameters: valid,
        }),
      'invalid-input',
    )
    expectCode(
      () =>
        archive.saveImprint({
          seedId: driftingFilamentsSeed.id,
          sourceRevision: REV_A,
          parameters: valid,
          parentImprintId: 'missing',
        }),
      'not-found',
    )
    expect(archive.getActiveImprint()).toBeNull()
  })
})

describe('seeds and mutations', () => {
  it('records mutation lineage and promotes a mutation to a seed', () => {
    const first = archive.recordMutation({
      id: 'drifting-m1',
      parent: { kind: 'seed', id: driftingFilamentsSeed.id },
      sourceRevision: REV_B,
      validation: { build: 'passed' },
    })
    const second = archive.recordMutation({
      id: 'drifting-m2',
      parent: { kind: 'mutation', id: first.id },
      sourceRevision: REV_B,
    })

    expect(archive.getMutation(second.id).parent).toEqual({ kind: 'mutation', id: first.id })
    expect(archive.getMutation(first.id).validation).toEqual({ build: 'passed' })

    const promoted = archive.promoteMutation(first.id)
    expect(promoted).toMatchObject({ id: first.id, promotedFromMutationId: first.id })
    expect(archive.listSeeds().map(({ id }) => id)).toContain(first.id)

    const imprint = archive.saveImprint({
      seedId: first.id,
      sourceRevision: REV_B,
      parameters: defaults(driftingFilamentsSeed),
    })
    expect(imprint.seedId).toBe(first.id)
  })

  it('rejects duplicates, missing parents, and undeclared modules', () => {
    expectCode(
      () => archive.registerSeed({ id: driftingFilamentsSeed.id, sourceRevision: REV_A }),
      'already-exists',
    )
    expectCode(
      () => archive.registerSeed({ id: 'unknown-seed', sourceRevision: REV_A }),
      'invalid-input',
    )
    expectCode(
      () =>
        archive.recordMutation({
          id: 'orphan',
          parent: { kind: 'mutation', id: 'nope' },
          sourceRevision: REV_A,
        }),
      'not-found',
    )
    expectCode(() => archive.promoteMutation('nope'), 'not-found')
  })
})

describe('immutability and integrity', () => {
  it('blocks updating or deleting archived rows', () => {
    const saved = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters: defaults(driftingFilamentsSeed),
    })
    archive.close()

    const db = new DatabaseSync(join(directory, 'archive.sqlite'))
    expect(() =>
      db.prepare('UPDATE imprints SET parameters = ? WHERE id = ?').run('{}', saved.id),
    ).toThrow(/immutable/)
    expect(() => db.prepare('DELETE FROM imprints WHERE id = ?').run(saved.id)).toThrow(/immutable/)
    expect(() => db.prepare('DELETE FROM seeds').run()).toThrow(/immutable/)
    db.close()
    archive = open()
  })

  it('reports a healthy archive and detects corrupt stored parameters', () => {
    const saved = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters: defaults(driftingFilamentsSeed),
    })
    expect(archive.verify()).toEqual([])
    archive.close()

    const db = new DatabaseSync(join(directory, 'archive.sqlite'))
    db.exec('DROP TRIGGER imprints_immutable_update')
    db.prepare('UPDATE imprints SET parameters = ? WHERE id = ?').run('not json', saved.id)
    db.close()
    archive = open()

    expect(archive.verify()).toHaveLength(1)
    expectCode(() => archive.getImprint(saved.id), 'corrupt')
  })

  it('refuses a database from a newer schema', () => {
    const path = join(directory, 'future.sqlite')
    const db = new DatabaseSync(path)
    db.exec('PRAGMA user_version = 999')
    db.close()

    expectCode(() => open(path), 'unsupported-schema')
  })
})

describe('backup and recovery', () => {
  it('restores lineage and the active imprint from a backup', async () => {
    const parameters = defaults(driftingFilamentsSeed)
    archive.recordMutation({
      id: 'drifting-m1',
      parent: { kind: 'seed', id: driftingFilamentsSeed.id },
      sourceRevision: REV_B,
    })
    archive.saveImprint({ seedId: driftingFilamentsSeed.id, sourceRevision: REV_A, parameters })
    const tip = archive.saveImprint({
      seedId: driftingFilamentsSeed.id,
      sourceRevision: REV_A,
      parameters,
    })
    const expectedChain = archive.getImprintAncestry(tip.id)

    const backupPath = join(directory, 'backup.sqlite')
    await archive.backup(backupPath)
    await expect(archive.backup(backupPath)).rejects.toBeInstanceOf(ArchiveError)

    const restored = open(backupPath)
    expect(restored.verify()).toEqual([])
    expect(restored.getActiveImprint()).toEqual(tip)
    expect(restored.getImprintAncestry(tip.id)).toEqual(expectedChain)
    expect(restored.getMutation('drifting-m1').parent).toEqual({
      kind: 'seed',
      id: driftingFilamentsSeed.id,
    })
    restored.close()
  })
})
