# ADR 0007: Live Mutation code storage and sandboxed execution

## Status

Proposed. Supersedes the "executable source is not stored" rule in
[ADR 0006](0006-local-control-service-and-archive.md) for runtime Mutations
only.

## Context

[Live evolution requirements](../live-evolution.md) call for Mutations created
while the installation runs, applied to a Presence live, observable, and
checked automatically. ADR 0006 assumed Seeds and Mutations are `.ts` modules
in Git, bundled at build time. That cannot produce code at runtime.

## Decision

- **Two kinds of Seed module.** _Bundled_ modules stay as `.ts` files in Git and
  are authored by the artist. _Runtime_ modules are created live by the AI and
  stored as source text in the archive.
- **Runtime source is data.** Each runtime Mutation stores its source text in
  SQLite, keyed by a SHA-256 content hash. The content hash is its source
  identity; a Git revision is required only for bundled modules. Source text is
  immutable like every other archive row.
- **Sandboxed execution only.** The browser runs runtime source solely inside a
  sandboxed iframe (`sandbox="allow-scripts"`, no same-origin access) that
  exposes a narrow message interface: parameters in, frames and health probe
  readings out. Runtime code has no access to `localStorage`, the control API,
  credentials, or the network (enforced by CSP `connect-src 'none'`). The
  service never executes runtime source.
- **Candidate then promote.** A new Mutation first runs in a candidate sandbox
  next to the displayed Presence. It replaces the displayed work only after the
  health checks pass; otherwise the Presence keeps the last stable module and
  the failure is returned to the AI as feedback.
- **Immutability is unchanged.** A runtime Mutation is a new module beside its
  parent. Imprints keep resolving to the exact source they were saved with.
- **Attempts are recorded.** Every proposal, check result, and decision is
  stored as an attempt event so the process can be viewed live and afterwards.
  Failed attempts keep their source for a bounded retention window, then
  compact to metadata only; kept and promoted Mutations are never compacted.
- **Review path to Git.** A runtime Mutation the artist promotes can be
  exported to a `.ts` file for committing, becoming a bundled Seed.

## Consequences

- ADR 0006's archive guarantees extend to source text, and the `mutations`
  table gains source and content-hash columns in a new migration (#10 as built
  does not yet store source).
- The renderer needs a sandbox host and a message protocol; this is the main new
  engineering cost and belongs to M4 (#20, #17).
- Runtime code cannot use build-time tooling, so typechecking and linting do not
  apply. Safety rests on the sandbox, resource limits, and checks.
- The artwork still renders without AI: bundled Seeds and stored Imprints do not
  depend on the live path.
- Archive size grows with attempts; the retention policy above bounds it.

## Alternatives considered

- **Service writes `.ts` files and rebuilds.** Keeps typechecking and Git
  history, but each attempt costs a build on a 4 GB laptop, adds a build
  pipeline to the live path, and gives code write access to the source tree.
- **Git-only, defer live mutation.** Safest, but contradicts the project's
  central intent of watching the AI work.
- **Run runtime code in the main page (`eval`/dynamic import).** Rejected: no
  isolation from storage, the control API, or the network.

## Open questions

- Should a Presence swap seamlessly to a new module or restart it?
- Which pixel-statistics probe feeds the health checks, and who runs it: the
  sandbox or the host page?
- Whether sandbox resource limits (CPU time, memory) can be enforced reliably in
  the browser on the laptop; this may need a worker-based variant.
