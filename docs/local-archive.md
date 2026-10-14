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

- Code nodes and promotions are immutable. Imprint content and provenance are
  immutable, but Imprints may be deleted when they are not active. Deleting an
  Imprint reparents its direct children to its former parent in one transaction,
  preserving the remaining lineage.
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

## Control API

Run the service with `pnpm server` (bundles `server/main.ts`, then runs it with
Node). It registers the bundled Seeds, restores the Presence from the archive
and listens on loopback only.

| Variable                 | Default                                       |
| ------------------------ | --------------------------------------------- |
| `PHYSIS_PORT`            | `4317`                                        |
| `PHYSIS_ARCHIVE_PATH`    | `data/archive.sqlite` (git-ignored)           |
| `PHYSIS_SOURCE_REVISION` | `git rev-parse HEAD`                          |
| `PHYSIS_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` |

Routes under `/api/v1`:

- `GET /health`
- `GET /presence`, `GET /presence/events` (SSE; current state on connect, then
  `event: presence` on every change)
- `POST /presence` with `{kind: "code" | "imprint", id}` selects anything from
  the archive; `PUT /presence/parameters` with `{parameters}` tweaks live
  values in memory only
- `GET /code-nodes[?role=seed|mutation]`, `/code-nodes/:id`,
  `/code-nodes/:id/ancestry`
- `GET /imprints[?codeId=]`, `/imprints/:id`, `/imprints/:id/ancestry`
- `POST /imprints` with optional `{parentId, randomSeed}` archives the current
  parameters; the server stamps `sourceRevision` and a `sourceDirty` flag
- `DELETE /imprints/:id` deletes an inactive Imprint and reparents its children
  to its former parent; deleting the active Imprint returns a conflict

Live tweaks are never archived until imprinted, and are lost on restart. The
service refuses non-loopback hosts, checks the `Host` and `Origin` headers, and
requires `application/json` on writes. There is no authentication in M2; the
service remains loopback-only until remote access is implemented according to
[ADR 0008](decisions/0008-remote-studio-network-and-authentication.md).
