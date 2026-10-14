# ADR 0009: Lineage Explorer graph and previews

## Status

Proposed

## Context

The Lineage Explorer combines two independent archive trees: code lineage
(Seeds and Mutations) and Imprint lineage. Every Imprint also references a
code node, which is not a parent relationship. The view is optional and must
not interrupt the artwork.

The archive's SQLite records and authenticated API are authoritative. The
current API exposes code-node and Imprint records, but the browser client
currently lists only Imprints. Preview images are not part of archive
metadata. The presentation laptop has an Intel Core i5-6200U, 4 GB RAM, and
Intel HD Graphics 520, so continuous layout simulations and eager animation
decoding are poor defaults.

## Decision

- Keep the Lineage Explorer at `/lineage`, separate from the artwork route.
  Keep its graph view reusable so it can later be hosted in a modal.
- Render code lineage and Imprint lineage in separate labeled lanes, using
  solid directed parent edges and a distinct dashed Imprint-to-code reference
  edge. Use a stable, layered SVG layout rather than a force-directed
  simulation.
- Activating a node focuses it and opens details. Changing the active Presence
  requires a separate explicit action and uses the existing selection API;
  unavailable code nodes are inspect-only.
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
- The SVG layout is deterministic and light, but very large archives may
  eventually need filtering or viewport culling based on measured need.
- Database-only backups do not preserve visual previews. Backups intended to
  retain the complete visual archive must include the preview directory.
- The proposed animation budgets require measurement on the presentation
  laptop before animations are enabled by default.

## Alternatives considered

- **One merged ancestry tree:** rejected because it would falsely imply that
  an Imprint-to-code reference is a parent relationship.
- **Force-directed graph:** rejected as the default because positions shift
  between visits and the simulation consumes CPU while the graph is open.
- **Store images in Imprint records or SQLite metadata:** rejected because
  screenshots are replaceable visual assets, not immutable Imprint content,
  and should not inflate metadata responses.
- **Retroactively render every historical entity:** rejected because source
  revisions and random runtime state may be unavailable; a new rendering
  would not establish what the archived entity looked like.
- **Animate every node automatically:** rejected because eager downloads,
  image decoding, and motion work against touch, reduced-motion, and memory
  constraints.
