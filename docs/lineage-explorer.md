# Lineage Explorer

Status: implementation is in progress for
[#51](https://github.com/hooman3030/physis/issues/51). The route-first SVG
graph, bounded static posters, worker-encoded GIF capture/storage, and
interaction-triggered playback are implemented. Performance measurement on
the presentation laptop remains outstanding; historical captures are not
backfilled. The graph and preview recommendations are recorded in
[ADR 0009](decisions/0009-lineage-explorer-graph-and-previews.md). See
[M3 in the roadmap](roadmap.md#m3--local-network-remote-studio).

## Intent

Provide an optional, navigable view of the artwork archive inspired by
Obsidian's node view. Seeds, Mutations, and Imprints appear as circular nodes
with saved visual previews. The explorer browses the existing archive; it
does not change how the archive stores lineage or how the artwork renders.

## Graph model and layout

Render one organic, force-directed SVG graph with a single kind of solid,
directed parent edge:

- A Seed or Mutation points to its parent Seed or Mutation.
- An Imprint with an Imprint parent points to that parent.
- Each root Imprint points to the code node it was created from.

Do not draw additional Imprint-to-code reference edges for Imprints that
already have an Imprint parent. The archive's `codeId` remains provenance and
is still available in the inspector.

Use `d3-force` for light link attraction, repulsion, centering, collision, and
damped chronological positioning while keeping React and SVG responsible for
rendering, accessible node controls, and preview images. Allow noticeable but
damped drift from the deterministic starting positions without springy settling.
Start from deterministic positions spread from oldest at the top toward newest at the
bottom; use a deterministic, creation-time-ordered horizontal subtree layout
to keep sibling branches in order. Let the force simulation organically make
room without losing those overall time and branch relationships, then stop
it. Give Imprints stronger repulsion and a larger collision radius so their
previews and labels have room. Re-run the force layout from saved positions
on each page load, allowing existing layouts to relax; users can still drag
nodes, pan the graph, and zoom the viewport, and arrow keys also move a
focused node. Save the latest node positions locally in the browser and
provide a reset control. Use small wheel-zoom increments and a 1.15x default
zoom. Never persist layout in the archive. Presence is current runtime state, not an archived node, and
is indicated without changing the graph relationships.
Allow zooming up to 3x. Only selected nodes have dotted sun-like selection
rings with a subtle wave animation; active Presence uses a solid ring. Keep the
wave still when reduced motion is requested.

The existing archive API already exposes code nodes, Imprints, their parents,
and each Imprint's `codeId`. The browser client will need validated list
methods for code nodes and Imprints. Do not change archive lineage semantics
to build the graph.

## Route and interaction

Open the explorer at `/lineage`; keep `/` as the artwork route. The graph
fills the viewport, with the back link and heading floating over its upper-left corner.
Use the selected node's poster as a softly blurred backdrop with a black
overlay that fades from 90% opacity at the top to transparent at one-third of
the viewport height; use a dark fallback when the node has no poster. Layer
sparse, subtle accent and warm-colored grain dots over the graph's existing
dotted background. Give the dots a depth effect by shifting and scaling each
layer at a different rate from the graph during pan and zoom, with the smallest
dots moving least, the foreground dots slightly larger, and all layers close to
the background. Cover the full graph viewport, including space outside the
content-sized graph viewBox. Center the grain
layers when the graph is at rest, and keep their parallax aligned with the
graph's zoom point. Keep them still when reduced motion is requested. Use a
1.15x centered default zoom and a noticeable zoom-in when the graph first loads
and after resetting its layout,
except when reduced motion is requested. Use translucent, blurred surfaces for
the graph controls. Do not show a detail inspector or explanatory graph copy.
Style lineage nodes with layered role-specific rims, a soft glass sheen, and
clear active and selected states. Keep parent lines crisp and directional over
a restrained glow, and preserve legible labels against the backdrop.
Crossfade poster changes over 450 ms, except when reduced motion is requested.
Keep the graph view
independent of the route shell so the same view can later be hosted in a modal
without changing the graph model.

Selecting a node focuses it, marks it with the dotted selection ring, changes
the backdrop, and activates it in the Presence when the control API is
connected and its code is available. Do not issue another activation request
when the selected node is already active. On initial load, select the active
Imprint if it exists in the archive; when there is no active Imprint, leave
the graph unselected. On initial load and after resetting the layout, center
the active archived Imprint, or the active archived code node when there is no
active Imprint. Reset immediately centers and zooms to that node using the
reset layout's initial position, keeps it centered while the force simulation
settles, then recenters without replaying the zoom. Fall back to the graph
center when Presence has no archived node.
An unavailable Seed or Mutation can still be selected, but cannot be
activated.

Delete mode is a separate multi-selection state: selecting a node there does
not change Presence. Only inactive Imprints can be selected for deletion; code
nodes and the active Imprint remain protected. Enter the mode with the
Delete switch; the trash-and-count button appears to its left. While delete
mode is off, the button is hidden but its slot remains reserved to keep the
toolbar stable. It deletes the selection after one
custom confirmation dialog with a brief destruction burst animation. The
dialog respects reduced motion and can be dismissed with Escape. Deletion uses
the archive API's existing
behavior, which preserves descendants by reparenting them. Successful
deletions disappear immediately and exit delete mode. Children are reparented
to the deleted Imprint's former parent; when that parent is absent, the
source-code lineage reconnects them to the Seed. Failed or unattempted
deletions are reported; if the entire batch fails, its selection remains for
retry.

Keyboard and touch users can select every node, which automatically activates
available nodes without relying on hover. Node type, active state, and parent
direction must remain understandable without color alone. Respect
`prefers-reduced-motion`; calculate a settled layout without visible motion
when it is enabled. Graph navigation and selection must not depend on
animation.

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
  files as unauthenticated static assets or rely on a public runtime service.
- Preview failure, missing files, or disabled animation never blocks the
  graph, the archive, or the artwork runtime.
- Keep initial placement deterministic and stop force simulation after
  settling; do not run a continuous simulation while the graph is idle.
- Keep user-moved positions local to the browser and provide a reset control.
- Keep the selected-node backdrop decorative and dark enough for graph
  controls and node labels to remain legible.
- Lazily load animated assets and enforce the size caps to bound transfer and
  decoded-image memory on the 4 GB presentation laptop.
- Before considering preloading or autoplay beyond explicit interaction,
  measure capture time, generated file sizes, and browser memory on the
  presentation laptop. Keep static posters and placeholders as the complete
  usable experience.
- Test root and descendant parent edges, force-layout stability, saved
  positions, dragging, pan/zoom, explicit Presence activation, direct
  `/lineage` loading, missing/invalid previews, reduced motion, and
  keyboard/touch access.
