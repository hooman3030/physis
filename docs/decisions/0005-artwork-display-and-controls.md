# ADR 0005: Artwork-first display with reusable controls

## Status

Accepted

## Context

The presentation display should show the artwork, not a permanent application
interface. Development needs a way to inspect and select seed modules and
adjust supported artwork Genes. The remote studio will also need
controls without coupling the artwork renderer to that dashboard.

## Decision

Start the artwork fullscreen with its in-art control panels hidden. Reveal
artwork controls with **C** or a discreet right-edge target; reveal the
Imprint archive with **A** or a discreet left-edge target. Both panels can
remain open together, and **Escape** closes them. Keep control components
independent of the display host so they can be reused in the future remote
studio. Add Gene editors when Seeds expose supported Gene metadata.
Numeric Genes declare their label, default, bounds, and step so the panel
can render suitable inputs. Parameter editing remains independent of the
display host.

The active seed ID identifies a program module, not a guarantee of identical
pixels across runs. The first-slice controls expose the active module ID and
label and allow switching among registered modules.

Keep the controls compact, with slimmer Gene sliders. Archive cards show
the module and creation time without Gene values. When both panels are
open, keep at least a 1rem gap between them on wider screens; at viewport
widths of 40rem or less, stack the panels into separate scrollable regions.

The browser client connects to the loopback control API when it is available,
uses its Presence as the active state, and receives updates through the
Presence event stream. If the API is unavailable, the artwork continues to
render and the controls operate locally; saving an Imprint requires the API.
The Imprint archive lists saved Imprints from the API and selecting one
restores its code and Genes into the active Presence.

User-facing control, archive, browser-storage, and unexpected runtime errors
are reported through persistent, dismissible toasts. Errors remain visible
until dismissed. A browser-storage failure is reported but does not prevent the
artwork from continuing with its in-memory or default settings.

## Consequences

- The installation can present the work without a permanent GUI.
- Developers retain a local way to inspect and switch active modules.
- Control state and rendering remain separable, allowing reuse in another
  host.
- The artwork runtime does not depend on the control API; while disconnected,
  browser controls do not persist changes to the archive.
- Seeds without Gene metadata do not display Gene inputs.
- The active Seed and each Seed's Gene values persist in the browser's
  `localStorage`. Stored values are validated against the seed's declared
  bounds on load, and the artwork renders with defaults if storage is
  missing or invalid.
- The remote dashboard remains future work.

## Alternatives considered

- **Keep a permanent on-screen control panel:** rejected because it competes
  with the artwork in presentation mode.
- **Use only the remote dashboard:** rejected because it would make local
  development and direct interaction less convenient.
- **Hard-code Gene inputs in the controls panel:** rejected because each
  Seed should declare which Genes it supports.
