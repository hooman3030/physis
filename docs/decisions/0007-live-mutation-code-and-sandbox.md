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

## Resolved questions

- **Swap or restart:** a Presence restarts on new code with a short crossfade.
  The candidate runs on its own canvas, and the display fades to it once the
  checks pass. Seeds are not required to expose state; an optional state
  handover contract can come later.
- **Probe:** the host page runs the health probe, never the code under test.
  The sandbox runtime wrapper posts downscaled frames (for example 32x32 per
  second) and the host computes brightness, coverage, variance, and
  frame-to-frame change.
- **Limits:** start with the sandboxed iframe plus a heartbeat watchdog. A
  stalled heartbeat or collapsed frame rate removes the iframe and counts as a
  failed check. A runaway synchronous loop can still freeze the tab; move to
  Worker plus `OffscreenCanvas` only if that happens.
- **Renderer-agnostic:** the sandbox contract must not be p5-specific. Runtime
  code targets a small renderer interface (parameters in, canvas and frames
  out), with p5, raw Canvas 2D, and later Three.js and raw shaders as
  interchangeable runtimes behind it. Each module declares its runtime.
- **Process view:** hidden but toggleable on the laptop panel; primarily
  viewed in the remote studio (M3).

## Runtime interface

A runtime is an adapter that turns module source and parameters into pixels.
The sandbox wrapper, not the module author, owns the canvas, the frame loop,
and the host messaging; the module supplies only drawing logic.

```ts
type RuntimeKind = 'p5' | 'canvas2d' | 'three' | 'shader'

interface ArtworkRuntime {
  mount(canvas: HTMLCanvasElement, source: string): void
  setParameters(values: Readonly<Record<string, number>>): void
  resize(width: number, height: number): void
  dispose(): void
}
```

- The wrapper drives timing: it calls the runtime's frame step, measures frame
  rate for the heartbeat, and posts downscaled frames to the host.
- Each runtime defines what `source` means: a p5 sketch function body, a Canvas
  2D `draw(ctx, time, params)` function, a Three.js scene factory, or a
  fragment shader with parameter uniforms. Adding a runtime means adding an
  adapter; the host, probe, archive, and watchdog do not change.
- Parameter declarations (`id`, `label`, `defaultValue`, `min`, `max`, `step`)
  are runtime-independent and remain the contract the archive validates.
- Libraries (p5, Three.js) are bundled with the sandbox page and served from
  the app's own origin, so the sandbox needs no network. Each iframe loads only
  the runtime named by its module.
- Frame sampling: the wrapper downscales the canvas into a small 2D canvas
  with `drawImage` in the same task as rendering, which also works for WebGL
  contexts and avoids a full `readPixels`. Its cost on the Intel HD 520 is
  unverified and must be measured on the laptop (#4) before M4 relies on it.

## Consequences for the Seed type

Before #24, `ArtworkSeed` in `src/seeds/types.ts` was p5-specific:
`createSketch` took a `p5` instance, and `ArtworkCanvas` mounted p5 directly.
Issue #24 implements the renderer-independent declaration and runtime boundary:

- `SeedDeclaration` (`id`, `label`, `parameters`, `runtime`) is shared by the
  archive and control API. `src/seeds/types.ts` has no renderer imports.
- `P5Seed` adds the p5-specific `createSketch` implementation. Existing seeds
  declare the `p5` runtime.
- `ArtworkCanvas` delegates mounting to the runtime adapter registry; p5 is
  the first adapter. Other renderers and runtime Mutation execution remain
  future work.

## Open questions

- Which model produces the proposals, and what request budget applies? Tracked
  in #13.
- Whether the Canvas 2D and shader source formats need a restricted API surface
  (for example, no `fetch` or DOM access) beyond the sandbox itself. Decide in
  #20.
