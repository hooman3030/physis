# ADR 0009: Lineage Explorer graph and previews

## Status

Accepted

## Context

The Lineage Explorer combines code lineage (Seeds and Mutations) with Imprint
lineage. Each Imprint records its source code node, but only root Imprints
use that source as their visual parent; descendants use their Imprint parent.
The view is optional and must not interrupt the artwork.

The archive's SQLite records and authenticated API are authoritative. The
current API exposes code-node and Imprint records, but the browser client
currently lists only Imprints. Preview images are not part of archive
metadata. The presentation laptop has an Intel Core i5-6200U, 4 GB RAM, and
Intel HD Graphics 520, so continuous layout simulations and eager animation
decoding are poor defaults.

## Decision

- Keep the Lineage Explorer at `/lineage`, separate from the artwork route.
  Keep its graph view reusable so it can later be hosted in a modal.
- Render a single force-directed SVG graph using `d3-force` for link,
  repulsion, centering, and collision forces. Draw one kind of solid directed
  parent edge: code parents, Imprint parents, and source-code-to-root-Imprint
  connections. Do not draw additional code-reference edges for descendant
  Imprints.
- Seed the simulation with deterministic positions and stop it after settling.
  Support dragging nodes, panning, zooming, and arrow-key movement. Persist
  moved positions in browser local storage, not the archive, and provide a
  reset control. Under reduced motion, calculate the settled layout without
  visible movement.
- Fill the viewport and float the back link and heading over its upper-left
  corner. Do not show a detail inspector or explanatory graph copy. Use the
  selected node's poster as a softly blurred backdrop with a black overlay
  that fades from 90% opacity to transparent over the top third of the
  viewport, crossfade poster changes over 450 ms unless reduced motion is
  requested, and use a dark fallback when there is no poster.
- Selecting a node changes the backdrop and activates it in Presence when the
  control API is connected and its code is available. Do not send a redundant
  activation request when the selected node is already active. On initial
  load, select the current Imprint if it exists in the archive; leave the
  graph unselected when there is no active Imprint.
- Keep previews separate from Imprint records as local filesystem assets.
  Capture from the running canvas when an entity is first rendered or an
  Imprint is saved. Capturing, encoding, and uploading are best-effort and
  never block the artwork or archive operation. Historical records without a
  capture use placeholders rather than inferred reconstructions.
- Use a small WebP poster (PNG fallback) as the default visual. Permit an
  optional, separately stored ping-pong GIF only within strict pixel, frame,
  and byte caps. Generate it locally in a worker and load it only on
  interaction. Reduced-motion settings disable it.
- Serve and upload assets only through authenticated API routes. Treat
  preview assets as supplementary to the database: restoring the database
  without the preview directory remains valid, with placeholders for missing
  previews.

## Consequences

- The graph can be built from existing archive relationships; the frontend
  needs validated code-node list methods and preview API support.
- No archive lineage migration is needed. Preview endpoints and filesystem
  lifecycle are additional implementation work and must validate IDs, image
  formats, dimensions, and size before writing.
- The force layout settles and stops rather than consuming CPU continuously.
  Very large archives may eventually need filtering or viewport culling based
  on measured need. User-specific positions remain local to each browser.
- Database-only backups do not preserve visual previews. Backups intended to
  retain the complete visual archive must include the preview directory.
- The proposed animation budgets require measurement on the presentation
  laptop before animations are enabled by default.

## Alternatives considered

- **Treat every Imprint's source-code association as ancestry:** rejected
  because only root Imprints use their source Code node as a visual parent;
  descendants follow their Imprint parent.
- **Canvas-based rendering:** rejected because SVG preserves accessible
  per-node controls and integrates the existing image previews without a
  separate interactive DOM overlay.
- **Unbounded force simulation:** rejected because it would consume CPU while
  the graph is idle; the selected simulation cools and stops.
- **Store images in Imprint records or SQLite metadata:** rejected because
  screenshots are replaceable visual assets, not immutable Imprint content,
  and should not inflate metadata responses.
- **Retroactively render every historical entity:** rejected because source
  revisions and random runtime state may be unavailable; a new rendering
  would not establish what the archived entity looked like.
- **Animate every node automatically:** rejected because eager downloads,
  image decoding, and motion work against touch, reduced-motion, and memory
  constraints.
