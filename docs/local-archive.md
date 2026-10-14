# Local archive

The archive is the SQLite store for Seeds, Mutations, and Imprints described in
[ADR 0006](decisions/0006-local-control-service-and-archive.md). It lives in
[server/archive/](../server/archive) and uses Node's built-in `node:sqlite`, so
no native dependency is needed. The control API (#11) will wrap it; the artwork
does not depend on it to render.

## Usage

```ts
import { openArchive } from './server/archive'
import { artworkSeeds } from './src/seeds/registry'

const archive = openArchive({ path: 'data/archive.sqlite', seeds: artworkSeeds })
archive.registerSeed({ id: 'drifting-filaments', sourceRevision: '<git commit hash>' })
const imprint = archive.saveImprint({
  seedId: 'drifting-filaments',
  sourceRevision: '<git commit hash>',
  parameters: { filamentCount: 160 },
})
```

Seed parameter declarations are supplied by the caller and used to validate
Imprints (known parameters, finite values, within bounds).

## Guarantees

- Seeds, Mutations, and Imprints are immutable; database triggers reject
  `UPDATE` and `DELETE`.
- Every save creates a child Imprint (default parent: the active Imprint) and
  moves the active pointer in one transaction. Failed saves leave no change.
- Schema changes are append-only migrations tracked by `PRAGMA user_version`.
  A database from a newer schema is refused.
- WAL journal with `synchronous=FULL` and foreign keys enforced.
- The source revision is a provenance label only; this version
  stores no source code and runs none (live Mutation source: ADR 0007).

## Backup and recovery

- `await archive.backup(destinationPath)` writes a consistent copy and refuses
  to overwrite an existing file.
- To restore, stop the service and open the backup file with `openArchive`
  (or copy it over the archive path).
- `archive.verify()` returns a list of problems from the SQLite integrity check,
  the foreign-key check, and stored-parameter parsing; an empty list means
  healthy.
