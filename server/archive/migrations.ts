import type { DatabaseSync } from 'node:sqlite'
import { ArchiveError } from './errors'

// Append-only once released: each entry upgrades the schema by one user_version.
const migrations: readonly string[] = [
  `
  -- A code node is a Seed or a Mutation; it is a Seed once promoted.
  CREATE TABLE code_nodes (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES code_nodes(id),
    source_revision TEXT NOT NULL,
    validation TEXT,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE promotions (
    code_id TEXT PRIMARY KEY REFERENCES code_nodes(id),
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE imprints (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES imprints(id),
    code_id TEXT NOT NULL REFERENCES code_nodes(id),
    source_revision TEXT NOT NULL,
    parameters TEXT NOT NULL,
    random_seed INTEGER,
    validation TEXT,
    created_at TEXT NOT NULL
  ) STRICT;

  -- The only mutable table: what is currently running, as a pointer.
  CREATE TABLE presence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    code_id TEXT REFERENCES code_nodes(id),
    imprint_id TEXT REFERENCES imprints(id)
  ) STRICT;

  INSERT INTO presence (id) VALUES (1);

  CREATE INDEX code_nodes_parent ON code_nodes(parent_id);
  CREATE INDEX imprints_parent ON imprints(parent_id);
  CREATE INDEX imprints_code ON imprints(code_id);

  CREATE TRIGGER code_nodes_immutable_update BEFORE UPDATE ON code_nodes
    BEGIN SELECT RAISE(ABORT, 'code nodes are immutable'); END;
  CREATE TRIGGER code_nodes_immutable_delete BEFORE DELETE ON code_nodes
    BEGIN SELECT RAISE(ABORT, 'code nodes are immutable'); END;
  CREATE TRIGGER promotions_immutable_update BEFORE UPDATE ON promotions
    BEGIN SELECT RAISE(ABORT, 'promotions are immutable'); END;
  CREATE TRIGGER promotions_immutable_delete BEFORE DELETE ON promotions
    BEGIN SELECT RAISE(ABORT, 'promotions are immutable'); END;
  CREATE TRIGGER imprints_immutable_update BEFORE UPDATE ON imprints
    BEGIN SELECT RAISE(ABORT, 'imprints are immutable'); END;
  CREATE TRIGGER imprints_immutable_delete BEFORE DELETE ON imprints
    BEGIN SELECT RAISE(ABORT, 'imprints are immutable'); END;
  `,
  `
  DROP TRIGGER imprints_immutable_update;
  DROP TRIGGER imprints_immutable_delete;

  CREATE TRIGGER imprints_content_immutable_update BEFORE UPDATE ON imprints
    WHEN NEW.id IS NOT OLD.id
      OR NEW.code_id IS NOT OLD.code_id
      OR NEW.source_revision IS NOT OLD.source_revision
      OR NEW.parameters IS NOT OLD.parameters
      OR NEW.random_seed IS NOT OLD.random_seed
      OR NEW.validation IS NOT OLD.validation
      OR NEW.created_at IS NOT OLD.created_at
    BEGIN SELECT RAISE(ABORT, 'Imprint content is immutable'); END;
  `,
  `
  ALTER TABLE imprints RENAME COLUMN parameters TO genes;

  DROP TRIGGER imprints_content_immutable_update;
  CREATE TRIGGER imprints_content_immutable_update BEFORE UPDATE ON imprints
    WHEN NEW.id IS NOT OLD.id
      OR NEW.code_id IS NOT OLD.code_id
      OR NEW.source_revision IS NOT OLD.source_revision
      OR NEW.genes IS NOT OLD.genes
      OR NEW.random_seed IS NOT OLD.random_seed
      OR NEW.validation IS NOT OLD.validation
      OR NEW.created_at IS NOT OLD.created_at
    BEGIN SELECT RAISE(ABORT, 'Imprint content is immutable'); END;
  `,
]

export const CURRENT_SCHEMA_VERSION = migrations.length

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  const current = row.user_version

  if (current > CURRENT_SCHEMA_VERSION) {
    throw new ArchiveError(
      'unsupported-schema',
      `Archive schema version ${current} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    )
  }

  for (let version = current; version < CURRENT_SCHEMA_VERSION; version += 1) {
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(migrations[version])
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
