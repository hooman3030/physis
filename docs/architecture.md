# Abstract architecture

## System boundary

Physis is a local-first installation with four separable concerns:

1. **Artwork runtime** renders the current stable work in a fullscreen browser.
2. **Evolution engine** proposes and validates changes on a schedule or in
   response to a prompt.
3. **Control plane and archive** store authoritative state, versions, prompts,
   logs, and snapshots.
4. **Remote studio** provides a local-network dashboard for observation and
   control.

The display must not depend on an AI request being in progress. The evolution
engine may fail, pause, or be unavailable while the artwork runtime continues
to show the last stable version.

## Conceptual flow

```text
authored seed + prompt
          |
          v
   evolution engine ---> candidate workspace ---> build/runtime checks
          |                                         |
          |                                   pass | fail
          |                                         v
          +------------------------------> promote / reject
                                                   |
                                                   v
                                         stable artwork + snapshot
```

The control plane records each outcome. A rejected candidate never replaces
the active stable version.

## Runtime and rendering

Start with browser-based procedural graphics. Canvas 2D or p5.js is the
preferred first rendering surface because it is approachable and lightweight.
Three.js can be introduced for 3D scenes, and raw shaders can follow when the
project has a concrete need. Supporting arbitrary video feeds from the
beginning would add complexity without helping the first milestone.

The browser should render algorithmically. AI should intervene only between
iterations, never once per animation frame.

## Evolution and safety

An iteration should be a bounded proposal:

1. Select a seed, prompt, and relevant history.
2. Generate a constrained change.
3. Save it in a separate candidate workspace.
4. Build and run it in an isolated browser context.
5. Check for errors, rendering failure, blank output, and resource violations.
6. Promote it only when checks pass; otherwise retain the stable version.
7. Record the result and capture a snapshot.

AI-generated artwork code must not be allowed to rewrite the backend, execute
arbitrary shell commands, install dependencies, or access provider secrets.

## State and archive

SQLite is appropriate for structured metadata. The filesystem can hold source
trees, generated builds, screenshots, and other larger assets. A version should
record at least:

- seed and version identifiers;
- parent version and lineage;
- rendering engine;
- authored prompt and change proposal;
- random seed and relevant parameters;
- creation time and validation results;
- snapshot references.

A snapshot is a captured state. A seed is a reproducible starting point for a
new branch. Selecting a snapshot as a seed must preserve the original branch.

## Remote studio

The laptop can serve a dashboard on its local network address. It should
support prompt submission, queue inspection, pause/resume, seed and snapshot
selection, version comparison, and logs. Control operations require
authentication even on the trusted network. Provider keys remain on the
laptop and are never sent to the dashboard.

## Candidate technology direction

The notes point toward a small TypeScript-based system:

- browser frontend: Vite, with p5.js first and Three.js later if needed;
- local API: Node.js and a lightweight TypeScript HTTP framework;
- metadata: SQLite plus the local filesystem;
- validation: browser runtime checks, build checks, and screenshots;
- supervision: the Linux service manager once unattended operation is
  implemented;
- optional hosted inference: an OpenRouter adapter, subject to current
  availability and limits.

These are planning recommendations, not implementation commitments.
