# ADR 0005: Artwork-first display with reusable controls

## Status

Accepted

## Context

The presentation display should show the artwork, not a permanent application
interface. Development still needs a way to inspect and select seed modules,
and future artwork parameters may need direct editing. The remote studio will
also need controls without coupling the artwork renderer to that dashboard.

## Decision

Start the artwork fullscreen with its in-art control panel hidden. Reveal the
panel with a keyboard shortcut or a discreet edge target. Keep control
components independent of the display host so they can be reused in the
future remote studio. Add parameter editors when seeds expose supported
parameter metadata; this decision does not invent a parameter model now.

The active seed ID identifies a program module, not a guarantee of identical
pixels across runs. The first-slice controls expose the active module ID and
label and allow switching among registered modules.

## Consequences

- The installation can present the work without a permanent GUI.
- Developers retain a local way to inspect and switch active modules.
- Control state and rendering remain separable, allowing reuse in another
  host.
- The remote dashboard and parameter-editing model remain future work.

## Alternatives considered

- **Keep a permanent on-screen control panel:** rejected because it competes
  with the artwork in presentation mode.
- **Use only the remote dashboard:** rejected because it would make local
  development and direct interaction less convenient.
- **Implement parameter editing immediately:** deferred until seed modules
  have a defined parameter interface.
