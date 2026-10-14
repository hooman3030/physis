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

const archive = openArchive({ path: 'data/archive.sqlite', modules: artworkSeeds })
archive.registerSeed({ id: 'drifting-filaments', sourceRevision: '<git commit hash>' })
archive.selectCode('drifting-filaments') // the Presence now runs this Seed at its defaults
const imprint = archive.saveImprint({
  codeId: 'drifting-filaments',
  sourceRevision: '<git commit hash>',
  parameters: { filamentCount: 160 },
})
```

Module parameter declarations are supplied by the caller and used to validate
Imprints (known parameters, finite values, within bounds).

## Data model

Seeds and Mutations share one table, `code_nodes`, because both are a code
revision with a parent. A node is a **Seed** once it has a row in `promotions`
and a **Mutation** otherwise; promotion is an append-only record, not a copy.
Authored root modules are registered as Seeds directly. Imprints form a second
lineage (`imprints.parent_id`) and reference the code node they were saved
under. Both lineages share the same core (`id`, `parent_id`, `created_at`),
exposed as `LineageNode` in TypeScript.

The **Presence** is a single mutable pointer (`code_id`, `imprint_id`), not a
lineage node. Selecting any Seed, Mutation, or Imprint (`selectCode`,
`selectImprint`) only moves the pointer and writes nothing else. An Imprint's
parent must belong to the same code node, so a lineage never crosses code.

## Guarantees

- Code nodes, promotions, and Imprints are immutable; database triggers reject
  `UPDATE` and `DELETE`. Only the Presence pointer changes.
- Every save creates an Imprint and moves the Presence to it in one
  transaction. The default parent is the Presence's Imprint when it runs the
  same code, otherwise the save starts a new root. Failed saves leave no change.
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
