# Lineage Explorer

Status: design recommendation complete for implementation in [#51](https://github.com/hooman3030/physis/issues/51).
The graph and preview decisions are recorded in
[ADR 0009](decisions/0009-lineage-explorer-graph-and-previews.md); review that
proposed decision before implementation. See [M3 in the roadmap](roadmap.md#m3--local-network-remote-studio).

## Intent

Provide an optional, navigable view of the artwork archive inspired by
Obsidian's node view. Seeds, Mutations, and Imprints appear as circular nodes
with saved visual previews. The explorer browses the existing archive; it
does not change how the archive stores lineage or how the artwork renders.

## Graph model and layout

Show three explicitly different relationships:

- **Code parent:** a Seed or Mutation points to its parent Seed or Mutation.
- **Imprint parent:** an Imprint points to its parent Imprint.
- **Code reference:** an Imprint refers to the Seed or Mutation whose code and
  source revision it records.

Keep code nodes and Imprints in separate, labeled lanes. Render parent edges
as solid directed lines and Imprint-to-code references as dashed lines with a
distinct legend. Never draw a reference as an ancestry edge. Presence is
current runtime state, not an archived node, and is not shown.

Use a deterministic, layered SVG layout rather than a force-directed
simulation. Arrange each lineage from parent to child, with stable sibling
ordering by creation time and ID. This avoids a continuously running layout,
keeps positions understandable between visits, and needs no graph-rendering
dependency. Reflow or stack the two lanes on narrow screens; keep node details
available in a responsive inspector and a keyboard-accessible node list.

The existing archive API already exposes code nodes, Imprints, their parents,
and each Imprint's `codeId`. The browser client will need validated list
methods for code nodes and Imprints. Do not change archive lineage semantics
to build the graph.

## Route and interaction

Open the explorer at `/lineage`; keep `/` as the artwork route. Start with a
standalone page, not an overlay. Keep the graph view independent of the route
shell so the same view can later be hosted in a modal without changing the
graph model.

Activating a node focuses it and opens its details; it does not immediately
change the active Presence. Provide a separate, explicit **Use in Presence**
action that reuses the existing code or Imprint selection API. Show the
action only when the control API is connected and the code node is available
in the running build. An unavailable Seed or Mutation remains inspectable but
cannot be activated. This avoids changing the artwork as a side effect of
graph exploration.

Keyboard users can reach and activate every node and relationship; touch
users get the same details and explicit action without hover. Node type,
active state, and edge type must remain understandable without color alone.
Respect `prefers-reduced-motion`; graph navigation and selection must not
depend on animation.

## Preview capture and storage

A preview is a replaceable visual asset, not Imprint data or provenance.
Capture the currently rendered artwork canvas opportunistically:

- Capture a Seed or Mutation after it is available and has rendered
  successfully in a Presence.
- Capture an Imprint when it is saved, using the canvas for the state being
  saved.
- Do not block artwork rendering, Imprint saving, or graph navigation on
  capture, encoding, or upload. Report capture failures through the existing
  error path and keep the entity usable.
- Do not claim to recreate old captures. Existing records without previews,
  and code unavailable in the current build, show a type-specific placeholder.
  A preview of a later rendering is not proof of the exact historical pixels.

Encode a static poster as WebP from the canvas, with PNG as a fallback if the
requested WebP encoding is unsupported. Keep the longest edge at or below
256 pixels and target at most 128 KiB per poster. See
[HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
and [MDN's WebP format notes](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types#webp).

Store preview files separately from SQLite metadata, under a local sibling
directory such as `data/previews/{kind}/{id}/`. Use fixed file names and
validated entity IDs; never accept a filesystem path from the client. Serve
and accept preview assets only through authenticated same-origin API routes.
Validate entity existence, media signatures, dimensions, and byte limits;
write uploads atomically. Deleting an Imprint removes its preview files
best-effort, while code-node previews follow the immutable code-node lifetime.

Preview assets are supplementary to the authoritative SQLite archive. A
database-only backup remains restorable but does not preserve its previews;
copy the preview directory as well when a backup is intended to preserve the
visual archive. Missing files always produce the placeholder, not a failed
archive load.

## Optional hover animation

Use a separate animated GIF only when an animation has been captured and
encoded successfully. Store the forward frames followed by their reverse to
make a ping-pong cycle. GIF has native browser playback and directly
represents the requested sequence; keep the static WebP poster as the normal
and failure view. Generate frames from the local canvas in a worker, not from
a remote service or a per-frame rendering loop.

Initial implementation budgets:

- at most 128 by 128 pixels;
- at most 24 frames, sampled at up to 8 frames per second;
- at most 512 KiB per animation.

These are caps, not targets: skip animation when capture or encoding would
exceed them. Load an animation only on pointer hover, keyboard focus, or an
explicit touch action; show the poster otherwise, and show at most one
animation at a time. Check `prefers-reduced-motion` before loading or playing
an animation, as well as styling the interface accordingly. See
[MDN's reduced-motion guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility).

## Constraints and implementation checks

- Keep the installation local-first. Preview reads and writes use the same
  authenticated `/api/v1` boundary as archive data; do not expose preview
  files as unauthenticated static assets or add a public dependency.
- Preview failure, missing files, or disabled animation never blocks the
  graph, the archive, or the artwork runtime.
- Keep graph layout deterministic and avoid continuous simulation.
- Lazily load animated assets and enforce the size caps to bound transfer and
  decoded-image memory on the 4 GB presentation laptop.
- Before enabling animations by default, measure capture time, generated file
  sizes, and browser memory on the presentation laptop. Keep static posters
  and placeholders as the complete usable experience.
- Test graph relationship types independently, explicit Presence activation,
  direct `/lineage` loading, missing/invalid previews, reduced motion, and
  keyboard/touch access.
