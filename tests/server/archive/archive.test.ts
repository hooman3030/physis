import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { driftingFilamentsSeed } from '../../../src/seeds/p5/drifting-filaments/seed'
import { firstLightSeed } from '../../../src/seeds/p5/first-light/seed'
import { firstOrbitSeed } from '../../../src/seeds/three/first-orbit/seed'
import {
  ArchiveError,
  openArchive,
  type Archive,
  type ModuleDeclaration,
} from '../../../server/archive'

const REV_A = 'a1b2c3d4e5f6'
const REV_B = '0123456789abcdef0123456789abcdef01234567'

const mutantDeclaration: ModuleDeclaration = {
  id: 'drifting-m1',
  label: 'Drifting Mutation',
  genes: driftingFilamentsSeed.genes,
  runtime: 'p5',
}
const declarations: ModuleDeclaration[] = [
  driftingFilamentsSeed,
  firstLightSeed,
  firstOrbitSeed,
  mutantDeclaration,
]

function defaults(seed: { genes: readonly { id: string; defaultValue: number }[] }) {
  return Object.fromEntries(seed.genes.map(({ id, defaultValue }) => [id, defaultValue]))
}

let directory: string
let archive: Archive
const open = (path = join(directory, 'archive.sqlite')) =>
  openArchive({ path, modules: declarations })

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

const seedId = driftingFilamentsSeed.id
const genes = () => defaults(driftingFilamentsSeed)
const save = (overrides: Record<string, unknown> = {}) =>
  archive.saveImprint({
    codeId: seedId,
    sourceRevision: REV_A,
    genes: genes(),
    ...overrides,
  })

describe('imprints', () => {
  it('saves and retrieves an imprint and points the presence at it', () => {
    const saved = save({ randomSeed: 42, validation: { ok: true } })

    expect(saved.parentId).toBeNull()
    expect(saved.codeId).toBe(seedId)
    expect(archive.getImprint(saved.id)).toEqual(saved)
    expect(archive.getPresence()).toEqual({ code: archive.getCodeNode(seedId), imprint: saved })
    expect(saved.randomSeed).toBe(42)
    expect(saved.validation).toEqual({ ok: true })
  })

  it('stores registered Auras with compatible Three Imprints', () => {
    archive.registerSeed({ id: firstOrbitSeed.id, sourceRevision: REV_A })
    const saved = archive.saveImprint({
      codeId: firstOrbitSeed.id,
      sourceRevision: REV_A,
      genes: defaults(firstOrbitSeed),
      auraId: 'soft-bloom',
      toneMappingId: 'agx',
    })

    expect(saved.auraId).toBe('soft-bloom')
    expect(saved.toneMappingId).toBe('agx')
    expect(archive.selectImprint(saved.id).imprint?.auraId).toBe('soft-bloom')
    expect(archive.selectImprint(saved.id).imprint?.toneMappingId).toBe('agx')
    expectCode(() => save({ auraId: 'soft-bloom' }), 'invalid-input')
    expectCode(() => save({ toneMappingId: 'agx' }), 'invalid-input')
    expectCode(
      () =>
        archive.saveImprint({
          codeId: firstOrbitSeed.id,
          sourceRevision: REV_A,
          genes: defaults(firstOrbitSeed),
          toneMappingId: 'unregistered',
        }),
      'invalid-input',
    )
  })

  it('chains saves as parent/child lineage without losing ancestors', () => {
    const first = save()
    const second = save()
    const third = save()

    expect(second.parentId).toBe(first.id)
    expect(archive.getImprintAncestry(third.id).map(({ id }) => id)).toEqual([
      first.id,
      second.id,
      third.id,
    ])
    expect(archive.getImprint(first.id)).toEqual(first)
  })

  it('branches from an earlier imprint and keeps the original branch', () => {
    const root = save()
    const left = save()
    const right = save({ parentId: root.id })

    expect(right.parentId).toBe(root.id)
    expect(archive.getImprint(left.id).parentId).toBe(root.id)
    expect(archive.listImprints(seedId).map(({ id }) => id)).toEqual(
      expect.arrayContaining([root.id, left.id, right.id]),
    )
  })

  it('rejects invalid input and leaves no partial state', () => {
    const valid = genes()
    const [firstKey] = Object.keys(valid)
    const withGenes = (values: Record<string, number>, codeId = seedId) =>
      archive.saveImprint({ codeId, sourceRevision: REV_A, genes: values })

    expectCode(() => withGenes({ ...valid, [firstKey]: Number.NaN }), 'invalid-input')
    expectCode(() => withGenes({ ...valid, [firstKey]: 1e9 }), 'invalid-input')
    expectCode(() => withGenes({ ...valid, bogus: 1 }), 'invalid-input')
    expectCode(() => withGenes({}), 'invalid-input')
    expectCode(() => withGenes(valid, 'unknown'), 'not-found')
    expectCode(() => save({ sourceRevision: 'nothex' }), 'invalid-input')
    expectCode(() => save({ parentId: 'missing' }), 'not-found')
    expect(archive.getPresence()).toEqual({ code: null, imprint: null })
    expect(archive.listImprints()).toEqual([])
  })

  it('rejects a parent imprint that belongs to different code', () => {
    const other = archive.registerSeed({ id: firstLightSeed.id, sourceRevision: REV_A })
    const parent = archive.saveImprint({ codeId: other.id, sourceRevision: REV_A, genes: {} })

    expectCode(() => save({ parentId: parent.id }), 'invalid-input')
  })

  it('deletes inactive Imprints and reparents their children to the former parent', () => {
    const root = save()
    const deleted = save()
    const child = save()
    const branch = save({ parentId: deleted.id })

    expectCode(() => archive.deleteImprint(branch.id), 'conflict')
    archive.deleteImprint(deleted.id)

    expectCode(() => archive.getImprint(deleted.id), 'not-found')
    expect(archive.getImprint(child.id).parentId).toBe(root.id)
    expect(archive.getImprint(branch.id).parentId).toBe(root.id)
    expect(archive.getImprintAncestry(child.id).map(({ id }) => id)).toEqual([root.id, child.id])
    expect(archive.getPresence().imprint?.id).toBe(branch.id)
  })
})

describe('presence', () => {
  it('selecting a seed starts at defaults and writes nothing to the archive', () => {
    const before = archive.listImprints().length
    const presence = archive.selectCode(seedId)

    expect(presence.code?.id).toBe(seedId)
    expect(presence.imprint).toBeNull()
    expect(archive.listImprints()).toHaveLength(before)
  })

  it('selecting an imprint switches to its code and saved Genes', () => {
    const imprint = save()
    archive.registerSeed({ id: firstLightSeed.id, sourceRevision: REV_A })
    archive.selectCode(firstLightSeed.id)
    expect(archive.getPresence().code?.id).toBe(firstLightSeed.id)

    const presence = archive.selectImprint(imprint.id)
    expect(presence.code?.id).toBe(seedId)
    expect(presence.imprint).toEqual(imprint)
    expectCode(() => archive.selectImprint('missing'), 'not-found')
    expectCode(() => archive.selectCode('missing'), 'not-found')
  })

  it('first save after selecting a different code starts a new root lineage', () => {
    const first = save()
    archive.registerSeed({ id: firstLightSeed.id, sourceRevision: REV_A })
    archive.selectCode(firstLightSeed.id)

    const other = archive.saveImprint({
      codeId: firstLightSeed.id,
      sourceRevision: REV_A,
      genes: {},
    })
    expect(other.parentId).toBeNull()

    archive.selectImprint(first.id)
    expect(save().parentId).toBe(first.id)
  })

  it('selecting a code after saving makes the next save a new root', () => {
    save()
    archive.selectCode(seedId)
    expect(save().parentId).toBeNull()
  })

  it('restores the presence after reopening the archive', () => {
    const saved = save()
    archive.close()
    archive = open()

    expect(archive.getPresence().imprint).toEqual(saved)
  })
})

describe('code nodes', () => {
  it('registers a root seed that is promoted from the start', () => {
    const node = archive.getCodeNode(seedId)
    expect(node).toMatchObject({ role: 'seed', parentId: null, sourceRevision: REV_A })
    expect(node.promotedAt).not.toBeNull()
  })

  it('records mutation lineage and promotes a mutation to a seed', () => {
    const first = archive.recordMutation({
      id: 'drifting-m1',
      parentId: seedId,
      sourceRevision: REV_B,
      validation: { build: 'passed' },
    })
    archive.recordMutation({ id: 'drifting-m2', parentId: first.id, sourceRevision: REV_B })

    expect(first).toMatchObject({ role: 'mutation', parentId: seedId, promotedAt: null })
    expect(first.validation).toEqual({ build: 'passed' })
    expect(archive.getCodeAncestry('drifting-m2').map(({ id }) => id)).toEqual([
      seedId,
      'drifting-m1',
      'drifting-m2',
    ])
    expect(archive.listCodeNodes('seed').map(({ id }) => id)).toEqual([seedId])

    const promoted = archive.promoteMutation(first.id)
    expect(promoted).toMatchObject({ id: first.id, role: 'seed', parentId: seedId })
    expect(archive.listCodeNodes('seed').map(({ id }) => id)).toContain(first.id)
    expect(archive.listCodeNodes('mutation').map(({ id }) => id)).toEqual(['drifting-m2'])
  })

  it('lets an unpromoted mutation run and be imprinted', () => {
    archive.recordMutation({ id: 'drifting-m1', parentId: seedId, sourceRevision: REV_B })

    const imprint = archive.saveImprint({
      codeId: 'drifting-m1',
      sourceRevision: REV_B,
      genes: genes(),
    })
    expect(imprint.codeId).toBe('drifting-m1')
  })

  it('rejects duplicates, missing parents, and undeclared modules', () => {
    expectCode(() => archive.registerSeed({ id: seedId, sourceRevision: REV_A }), 'already-exists')
    expectCode(
      () => archive.registerSeed({ id: 'unknown-seed', sourceRevision: REV_A }),
      'invalid-input',
    )
    expectCode(
      () => archive.recordMutation({ id: 'orphan', parentId: 'nope', sourceRevision: REV_A }),
      'not-found',
    )
    expectCode(() => archive.promoteMutation('nope'), 'not-found')
    expectCode(() => archive.promoteMutation(seedId), 'already-exists')
    archive.recordMutation({ id: 'undeclared', parentId: seedId, sourceRevision: REV_A })
    expectCode(() => archive.promoteMutation('undeclared'), 'invalid-input')
  })
})

describe('immutability and integrity', () => {
  it('keeps Imprint content immutable while allowing lineage repair and deletion', () => {
    const saved = save()
    archive.selectCode(seedId)
    archive.close()

    const db = new DatabaseSync(join(directory, 'archive.sqlite'))
    const attempt =
      (sql: string, ...args: string[]) =>
      () =>
        db.prepare(sql).run(...args)
    expect(attempt('UPDATE imprints SET genes = ? WHERE id = ?', '{}', saved.id)).toThrow(
      /immutable/,
    )
    expect(attempt('UPDATE imprints SET aura_id = ? WHERE id = ?', 'off', saved.id)).toThrow(
      /immutable/,
    )
    expect(
      attempt('UPDATE imprints SET tone_mapping_id = ? WHERE id = ?', 'agx', saved.id),
    ).toThrow(/immutable/)
    expect(attempt('UPDATE imprints SET parent_id = NULL WHERE id = ?', saved.id)).not.toThrow()
    expect(attempt('DELETE FROM imprints WHERE id = ?', saved.id)).not.toThrow()
    expect(attempt('UPDATE code_nodes SET source_revision = ?', REV_B)).toThrow(/immutable/)
    expect(attempt('DELETE FROM code_nodes')).toThrow(/immutable/)
    expect(attempt('DELETE FROM promotions')).toThrow(/immutable/)
    db.close()
    archive = open()
  })

  it('migrates version-one Imprints to support deletion', () => {
    const root = save()
    const child = save()
    const path = join(directory, 'archive.sqlite')
    archive.close()

    const db = new DatabaseSync(path)
    db.exec(`
      DROP TRIGGER imprints_content_immutable_update;
      ALTER TABLE imprints DROP COLUMN tone_mapping_id;
      ALTER TABLE imprints DROP COLUMN aura_id;
      ALTER TABLE imprints RENAME COLUMN genes TO parameters;
      CREATE TRIGGER imprints_immutable_update BEFORE UPDATE ON imprints
        BEGIN SELECT RAISE(ABORT, 'imprints are immutable'); END;
      CREATE TRIGGER imprints_immutable_delete BEFORE DELETE ON imprints
        BEGIN SELECT RAISE(ABORT, 'imprints are immutable'); END;
      PRAGMA user_version = 1;
    `)
    db.close()

    archive = open()
    archive.selectCode(seedId)
    archive.deleteImprint(root.id)

    expect(archive.getImprint(child.id).parentId).toBeNull()
    expect(archive.listImprints().map(({ id }) => id)).toEqual([child.id])
    expect(archive.verify()).toEqual([])
  })

  it('migrates version-two Imprint parameters to Genes without losing values', () => {
    const saved = save()
    archive.close()

    const db = new DatabaseSync(join(directory, 'archive.sqlite'))
    db.exec(`
      DROP TRIGGER imprints_content_immutable_update;
      ALTER TABLE imprints DROP COLUMN tone_mapping_id;
      ALTER TABLE imprints DROP COLUMN aura_id;
      ALTER TABLE imprints RENAME COLUMN genes TO parameters;
      CREATE TRIGGER imprints_content_immutable_update BEFORE UPDATE ON imprints
        WHEN NEW.parameters IS NOT OLD.parameters
        BEGIN SELECT RAISE(ABORT, 'Imprint content is immutable'); END;
      PRAGMA user_version = 2;
    `)
    db.close()

    archive = open()
    expect(archive.getImprint(saved.id).genes).toEqual(saved.genes)
    expect(archive.getImprint(saved.id).auraId).toBeNull()
    expect(archive.getImprint(saved.id).toneMappingId).toBeNull()
    expect(archive.verify()).toEqual([])
  })

  it('reports a healthy archive and detects corrupt stored Genes', () => {
    const saved = save()
    expect(archive.verify()).toEqual([])
    archive.close()

    const db = new DatabaseSync(join(directory, 'archive.sqlite'))
    db.exec('DROP TRIGGER imprints_content_immutable_update')
    db.prepare('UPDATE imprints SET genes = ? WHERE id = ?').run('not json', saved.id)
    db.close()
    archive = open()

    expect(archive.verify()).toHaveLength(1)
    expectCode(() => archive.getImprint(saved.id), 'corrupt')
  })

  it('detects corrupt stored tone-mapping IDs', () => {
    archive.registerSeed({ id: firstOrbitSeed.id, sourceRevision: REV_A })
    const saved = archive.saveImprint({
      codeId: firstOrbitSeed.id,
      sourceRevision: REV_A,
      genes: defaults(firstOrbitSeed),
      toneMappingId: 'agx',
    })
    archive.close()

    const db = new DatabaseSync(join(directory, 'archive.sqlite'))
    db.exec('DROP TRIGGER imprints_content_immutable_update')
    db.prepare('UPDATE imprints SET tone_mapping_id = ? WHERE id = ?').run('unregistered', saved.id)
    db.close()
    archive = open()

    expect(archive.verify()).toContain(`Tone mapping of imprint ${saved.id} is not registered`)
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
  it('restores lineage and the presence from a backup', async () => {
    archive.recordMutation({ id: 'drifting-m1', parentId: seedId, sourceRevision: REV_B })
    save()
    const tip = save()
    const expectedChain = archive.getImprintAncestry(tip.id)

    const backupPath = join(directory, 'backup.sqlite')
    await archive.backup(backupPath)
    await expect(archive.backup(backupPath)).rejects.toBeInstanceOf(ArchiveError)

    const restored = open(backupPath)
    expect(restored.verify()).toEqual([])
    expect(restored.getPresence().imprint).toEqual(tip)
    expect(restored.getImprintAncestry(tip.id)).toEqual(expectedChain)
    expect(restored.getCodeAncestry('drifting-m1').map(({ id }) => id)).toEqual([
      seedId,
      'drifting-m1',
    ])
    restored.close()
  })
})
