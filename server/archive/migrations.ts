import type { DatabaseSync } from 'node:sqlite'
import { ArchiveError } from './errors'

// Append-only: each entry upgrades the schema by one user_version.
const migrations: readonly string[] = [
  `
  CREATE TABLE mutations (
    id TEXT PRIMARY KEY,
    parent_seed_id TEXT REFERENCES seeds(id),
    parent_mutation_id TEXT REFERENCES mutations(id),
    source_revision TEXT NOT NULL,
    validation TEXT,
    created_at TEXT NOT NULL,
    CHECK ((parent_seed_id IS NULL) <> (parent_mutation_id IS NULL))
  ) STRICT;

  CREATE TABLE seeds (
    id TEXT PRIMARY KEY,
    source_revision TEXT NOT NULL,
    promoted_from_mutation_id TEXT REFERENCES mutations(id),
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE imprints (
    id TEXT PRIMARY KEY,
    parent_imprint_id TEXT REFERENCES imprints(id),
    seed_id TEXT NOT NULL REFERENCES seeds(id),
    source_revision TEXT NOT NULL,
    parameters TEXT NOT NULL,
    random_seed INTEGER,
    validation TEXT,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE presence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_imprint_id TEXT REFERENCES imprints(id)
  ) STRICT;

  INSERT INTO presence (id, active_imprint_id) VALUES (1, NULL);

  CREATE INDEX imprints_parent ON imprints(parent_imprint_id);
  CREATE INDEX imprints_seed ON imprints(seed_id);

  CREATE TRIGGER seeds_immutable_update BEFORE UPDATE ON seeds
    BEGIN SELECT RAISE(ABORT, 'seeds are immutable'); END;
  CREATE TRIGGER seeds_immutable_delete BEFORE DELETE ON seeds
    BEGIN SELECT RAISE(ABORT, 'seeds are immutable'); END;
  CREATE TRIGGER mutations_immutable_update BEFORE UPDATE ON mutations
    BEGIN SELECT RAISE(ABORT, 'mutations are immutable'); END;
  CREATE TRIGGER mutations_immutable_delete BEFORE DELETE ON mutations
    BEGIN SELECT RAISE(ABORT, 'mutations are immutable'); END;
  CREATE TRIGGER imprints_immutable_update BEFORE UPDATE ON imprints
    BEGIN SELECT RAISE(ABORT, 'imprints are immutable'); END;
  CREATE TRIGGER imprints_immutable_delete BEFORE DELETE ON imprints
    BEGIN SELECT RAISE(ABORT, 'imprints are immutable'); END;
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
