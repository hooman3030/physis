# Abstract architecture

The local-first runtime boundary follows
[ADR 0001](decisions/0001-local-first-no-local-model.md). The first-slice
frontend and its scope are recorded in
[ADR 0003](decisions/0003-first-slice-static-canvas.md),
[ADR 0004](decisions/0004-react-vite-plus-frontend.md), and
[ADR 0005](decisions/0005-artwork-display-and-controls.md).

## System boundary

Physis is a local-first installation with four separable concerns:

1. **Artwork runtime** renders the current stable work in a fullscreen browser.
2. **Evolution engine** proposes and validates changes on a schedule or in
   response to a prompt.
3. **Control plane and archive** store Seed and Mutation lineage, Imprints,
   active Presence state, prompts, and logs.
4. **Remote studio** provides a local-network dashboard for observation and
   control.

The display must not depend on an AI request being in progress. The evolution
engine may fail, pause, or be unavailable while the artwork runtime continues
to show the last stable version.

## Conceptual flow

```text
Seed + active Imprint
          |
          v
      Presence ------------------------> fullscreen display

authored Seed + prompt
          |
          v
   evolution engine ---> candidate Mutation ---> build/runtime checks
                              |                     |
                              |                pass | fail
                              |                     v
                              +------------> promote / reject
                              |
                        promoted Mutation
                              |
                              v
                         new Seed
```

An Imprint records the Genes used by a Presence and can have a parent
Imprint, forming a trait lineage. A Mutation records a source-code change and
can have a parent Seed or Mutation, forming a separate code lineage. An
Imprint references the Seed and source revision it uses. The control plane
records both lineages; a rejected Mutation never replaces the active Seed.

## Runtime and rendering

Use browser-based procedural graphics. p5.js remains available for 2D Seeds;
Three.js is the 3D runtime. Three Seeds use `WebGPURenderer`, which selects
WebGPU when available and falls back to WebGL 2, with TSL as the only shading
language. Seeds that require WebGPU compute declare that capability and the
runtime reports an error if initialization selects the WebGL 2 fallback.
Do not add a direct `WebGLRenderer` or raw shader path. See
[`three-seeds.md`](three-seeds.md) for the Seed contract and import guidance.
Supporting arbitrary video feeds would add complexity without helping the
artwork runtime.

The browser should render algorithmically. AI should intervene only between
iterations, never once per animation frame.

The installed artwork display starts without visible controls. A discreet
in-art control panel is available by keyboard shortcut or edge target for
development and direct interaction. Keep its control components independent
of their host so the same controls can be embedded in a future remote studio.
The artwork remains fullscreen when the panel is closed.
The shared typography, shape, and surface tokens are documented in the
[UI design system](ui-design-system.md).

## Evolution and safety

Code evolution should be a bounded proposal:

1. Select a Seed, prompt, and relevant history.
2. Generate a constrained change.
3. Save it as a child Mutation in a separate candidate workspace.
4. Build and run it in an isolated browser context.
5. Check for errors, rendering failure, blank output, and resource violations.
6. Promote it to a new Seed only when checks pass; otherwise retain the active
   Seed.
7. Record the result and its lineage.

Saving changed live Genes creates a child Imprint. The active Presence
can continue rendering while it advances to the saved child Imprint.

AI-generated artwork code must not be allowed to rewrite the backend, execute
arbitrary shell commands, install dependencies, or access provider secrets.

## State and archive

SQLite is appropriate for structured metadata. The filesystem can hold source
trees, generated builds, screenshots, and other larger assets. The archive
should record at least:

- **Seed:** stable identity, approved source revision, and creation metadata.
- **Mutation:** stable identity, parent Seed or Mutation, source revision, and
  validation/promotion metadata.
- **Imprint:** stable identity, parent Imprint, Seed and source revision used,
  Gene values, random seed when applicable, creation time, and validation
  metadata.
- **Presence:** the active Imprint and runtime status; it can resume from its
  last-known-good local settings if the control service is unavailable.

Imprints capture Gene state, not screenshots. A visual capture, if
needed later, is a separate image asset linked to a Presence or Imprint and
does not replace the Imprint's Gene data. Selecting an Imprint as the
starting state for further work creates a child Imprint and preserves its
ancestors.

## Remote studio

The laptop can serve a dashboard on a trusted private-network address, with
Wi-Fi as the normal access path. Private-network Ethernet clients are also
allowed if excluding them would require special interface or firewall
configuration. Remote access is opt-in, restricted by the host firewall to
the trusted local network, and must not be exposed to the public internet.
The Node service serves the built browser bundle and control API from the same
origin. The fullscreen presentation and remote studio reuse the responsive
bundle, while each browser renders its own artwork canvas.

When remote access is enabled, control and archive routes, including Presence
events, require an installation-wide bearer token. A phone requests pairing;
a short-lived, one-time PIN appears only on the installation display, and the
phone exchanges it for a remembered browser credential. PIN guesses are
rate-limited, and the installation token remains in machine-local storage,
never in source control or a URL. Presence events use authenticated fetch
streaming rather than native `EventSource`. The local installation display is
recognized by its source address and does not need pairing. Provider keys
remain on the laptop and are never sent to the dashboard.

The baseline uses HTTP only on the trusted private network, so another device
able to observe that network could capture the token. Guest, public, and
untrusted Wi-Fi are out of scope. Use a private VPN or add transport
encryption before enabling untrusted or off-site access. Host and Origin
checks remain defense in depth; the M2 loopback-only service remains
unauthenticated for local development. See
[ADR 0008](decisions/0008-remote-studio-network-and-authentication.md).

## Candidate technology direction

The notes point toward a small TypeScript-based system:

- browser frontend: Vite, with p5.js for existing 2D Seeds and Three.js
  `WebGPURenderer` plus TSL for 3D Seeds;
- local API: Node.js and a lightweight TypeScript HTTP framework;
- metadata: SQLite plus the local filesystem;
- validation: browser runtime checks, build checks, and screenshots;
- supervision: the Linux service manager once unattended operation is
  implemented;
- optional hosted inference: an OpenRouter adapter, subject to current
  availability and limits.

These are planning recommendations, not implementation commitments.
