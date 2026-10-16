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
archive.selectCode('drifting-filaments') // the Presence starts at Seed defaults, including its default Aura
const imprint = archive.saveImprint({
  codeId: 'drifting-filaments',
  sourceRevision: '<git commit hash>',
  genes: { filamentCount: 240 },
  auraId: 'soft-bloom',
})
```

Seed Gene declarations are supplied by the caller and used to validate
Imprints (known Genes, finite values, within bounds). Aura IDs must refer to a
known Aura preset compatible with the Seed's runtime.

## Data model

Seeds and Mutations share one table, `code_nodes`, because both are a code
revision with a parent. A node is a **Seed** once it has a row in `promotions`
and a **Mutation** otherwise; promotion is an append-only record, not a copy.
Authored root modules are registered as Seeds directly. Imprints form a second
lineage (`imprints.parent_id`) and reference the code node they were saved
under. Both lineages share the same core (`id`, `parent_id`, `created_at`),
exposed as `LineageNode` in TypeScript.

The **Presence** is a single mutable pointer (`code_id`, `imprint_id`) plus
transient playback and Aura selection state, not a lineage node. Selecting a
Seed or Mutation starts with its default Aura, or Off if it has none. Selecting
an Imprint restores its captured Aura; older Imprints without an Aura use the
Seed default or Off. Playback and an unsaved Aura change are shared by
connected clients but are not independently archived; saving an Imprint
captures the active Aura. Playback defaults to running at 1× after a service
restart. An Imprint's parent must belong to the same code node, so a lineage
never crosses code.

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
  the foreign-key check, and stored-Gene parsing; an empty list means
  healthy.

The planned Lineage Explorer previews are supplementary files stored beside
the database under `previews/`, not archive metadata. A database-only backup
remains valid but omits those visuals; include the preview directory when
preserving the complete visual archive matters. Missing preview files use a
placeholder and do not make the archive unhealthy.

## Control API

Run the service with `pnpm server` (builds the browser bundle and bundles
`server/main.ts`, then runs it with Node). It registers the bundled Seeds,
restores the Presence from the archive, serves the browser bundle, and listens
on loopback by default. `pnpm dev` uses Vite for the browser app and proxies
`/api` requests to the loopback service.

| Variable                   | Default                                             |
| -------------------------- | --------------------------------------------------- |
| `PHYSIS_PORT`              | `4317`                                              |
| `PHYSIS_BIND_HOST`         | `127.0.0.1` (loopback only)                         |
| `PHYSIS_ARCHIVE_PATH`      | `data/archive.sqlite` (git-ignored)                 |
| `PHYSIS_SOURCE_REVISION`   | `git rev-parse HEAD`                                |
| `PHYSIS_ALLOWED_ORIGINS`   | `http://127.0.0.1:5173,http://localhost:5173`       |
| `PHYSIS_REMOTE_TOKEN`      | unset; optional environment override                |
| `PHYSIS_REMOTE_TOKEN_FILE` | `${XDG_CONFIG_HOME:-~/.config}/physis/remote-token` |
| `PHYSIS_WEB_ROOT`          | `dist`                                              |

`pnpm server` also loads optional, machine-local settings from `.env.local`.
Copy `.env.example` once and edit the private bind address there; `.env.local`
is ignored by Git. Update the address if the laptop receives a different
private IP. This uses Node's optional env-file support, available in Node 22.9
and later.

Routes under `/api/v1`:

- `GET /health`
- `POST /pairing/request`, `GET /pairing/status`,
  `POST /pairing/complete` with `{pin}`, and local-only `POST /pairing/dismiss`
- `GET /presence`, `GET /presence/events` (SSE; current state on connect, then
  `event: presence` on every change, including Aura selection)
- `POST /presence` with `{kind: "code" | "imprint", id}` selects anything from
  the archive; `PUT /presence/genes` with `{genes}` tweaks live
  values in memory only
- `PUT /presence/playback` with `{paused: boolean}` pauses or resumes, or
  `{speed: number}` sets the active Presence speed from 0.1× to 4×; responses
  and Presence events include `paused` and `speed`
- `GET /code-nodes[?role=seed|mutation]`, `/code-nodes/:id`,
  `/code-nodes/:id/ancestry`
- `GET /imprints[?codeId=]`, `/imprints/:id`, `/imprints/:id/ancestry`
- `POST /imprints` with optional `{parentId, randomSeed}` archives the current
  Genes and Aura; the server stamps `sourceRevision` and a `sourceDirty` flag
- `DELETE /imprints/:id` deletes an inactive Imprint and reparents its children
  to its former parent; deleting the active Imprint returns a conflict

Live Gene tweaks, playback controls, and Aura changes are never archived until
an Imprint is saved; after restart, the selected Imprint's Aura or the Seed
default is restored. Browser runtimes use a renderer-neutral playback clock that exposes
scaled elapsed and delta time; renderers may map that time to simulation steps
or shader uniforms. If the control API is unavailable, each browser keeps
rendering in its last locally known playback state; playback controls cannot
change the authoritative state until the API reconnects. The loopback service
checks the `Host` and `Origin` headers and requires
`application/json` on writes. Loopback development remains unauthenticated.

### Opt-in remote access

Create the installation secret once on the laptop:

```sh
pnpm remote:token
```

The command stores 32 random bytes in the machine-local config directory with
mode `0600`; it does not print the secret. The browser receives its credential
only after successful PIN pairing. To revoke paired browsers, run
`pnpm remote:token -- --replace` and restart the service. An
environment-provided `PHYSIS_REMOTE_TOKEN` overrides the token file.

Copy the example config and set the laptop's private interface address (RFC 1918
IPv4 or IPv6 ULA):

```sh
cp -n .env.example .env.local
```

Edit `.env.local`, replacing the example IP, then run:

```sh
pnpm server
```

The Node service prints a URL such as `http://192.168.1.20:4317`. Open that URL
on the installation display and on devices connected to the same trusted
network. On a phone, choose **Request PIN**; the temporary six-digit code then
appears on the installation display. Enter it on the phone to pair that
browser. The code expires after five minutes, is consumed on success, and is
protected by a short lockout after repeated incorrect attempts. Paired browsers
remember their credential; no long token needs to be typed or copied.

Remote mode refuses wildcard or public addresses and authenticates control,
archive, and Presence-event requests. The installation display is recognized
by its local connection and does not need pairing. Keep the host firewall
restricted to the trusted LAN. Do not use guest, public, or untrusted Wi-Fi,
and do not configure router port forwarding; the baseline HTTP connection does
not encrypt credentials in transit. See
[ADR 0008](decisions/0008-remote-studio-network-and-authentication.md).
