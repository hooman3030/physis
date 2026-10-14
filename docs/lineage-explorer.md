# Lineage Explorer

Status: artist-requested direction; graph and preview design need research
before implementation. See [M3 in the roadmap](roadmap.md#m3--local-network-remote-studio),
[#50](https://github.com/hooman3030/physis/issues/50), and
[#51](https://github.com/hooman3030/physis/issues/51).

## Intent

Provide an at-a-glance, navigable view of the artwork archive inspired by
Obsidian's node view. Seeds, Mutations, and Imprints appear as circular nodes
whose visual is a saved screenshot of that entity. The view should make the
artwork's different kinds of lineage understandable without changing how the
archive stores or renders it.

## Graph model

The explorer must preserve the archive's two distinct lineages and their
cross-reference:

- **Code lineage:** a Seed or Mutation node links to its parent Seed or
  Mutation.
- **Imprint lineage:** an Imprint links to its parent Imprint.
- **Code reference:** each Imprint links to the Seed or Mutation whose code
  and source revision it records.

These links must be visually distinguishable. The code and Imprint
relationships must not be flattened into one ancestry chain. Presence is the
currently running work, not an archived lineage node, and is not included as
a node in this view.

The explorer is a browser for the existing archive, not a new archive model.
Selecting or activating nodes should follow the behavior determined by the
design issue, reusing the existing archive selection behavior where suitable.

## Visual and interaction direction

- Present each Seed, Mutation, and Imprint as a circular node with its saved
  screenshot as the primary visual.
- On hover, play a short ping-pong animation of the entity, preferably as a
  GIF or an equivalent lightweight animated preview. The saved screenshot is
  the static poster and fallback.
- Preserve clear node-type and relationship cues so the graph remains
  understandable when previews are still, missing, or not animated.
- Keep the explorer optional; it must not permanently cover the fullscreen
  artwork.
- Provide a usable non-hover path for touch and keyboard input, and respect
  reduced-motion preferences.

## Constraints

- Keep archive metadata and visual assets separate: a screenshot is not an
  Imprint and never replaces its immutable Gene data or provenance.
- Keep the feature local-first and lightweight. Any remote access must reuse
  the existing local-network authentication boundary; do not introduce a
  public service or public asset dependency.
- Loading, capturing, or failing to load previews must not block the explorer
  or the artwork runtime.
- Existing archive/API lineage semantics remain authoritative. Any required
  archive, API, or asset-storage change must be justified by the design work
  and documented before implementation.

## Open design questions

[#50](https://github.com/hooman3030/physis/issues/50) will recommend an
approach for:

- how to render both lineages and the Imprint-to-code reference as one
  navigable graph without implying false ancestry;
- what node activation does and how the graph is navigated at different
  screen sizes;
- how screenshots are generated for historical and newly saved entities,
  including what runtime state can reliably be reproduced;
- whether the hover animation is a GIF or another format, how its frames are
  captured, and how previews are stored, bounded, and refreshed;
- fallback behavior when a screenshot or animation is unavailable, and
  performance, reduced-motion, and keyboard/touch interaction requirements.

## Planned work

1. Specify the graph, preview-capture and storage model, and interactions
   ([#50](https://github.com/hooman3030/physis/issues/50)).
2. Build the explorer and preview behavior after the design is resolved
   ([#51](https://github.com/hooman3030/physis/issues/51)).
