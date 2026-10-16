# Glossary

- **Seed** – a pre-built, self-contained artwork module that can render a
  fullscreen piece. A seed has an identity and implementation; it is not just
  a text value or random number.
- **Mutation** – a child source-code revision created by changing a Seed.
  Selected Mutations may be promoted to Seeds; a Seed is a promoted code node.
- **Gene** – a bounded, Seed-declared artistic trait that influences how the
  artwork is rendered. A Gene has a current value in a Presence.
- **Imprint** – an immutable capture of an artwork's Genes (and random
  seed when applicable) at a point in time. It references the Seed and source
  revision used to render it and may have a parent Imprint. It is data, not a
  screenshot.
- **Presence** – an artwork currently running in the browser: a pointer to the
  Seed or Mutation it runs and, optionally, the Imprint it started from. It is
  not part of any lineage; selecting anything in the archive starts a Presence.
  Its transient playback state is authoritative in the local control service
  and shared with connected clients.
- **Environment** – an adjustable influence on how a Presence's Gene values
  change over time. Saved-Imprint-informed bias is a future direction, not yet
  a defined analysis.
- **Aura** – a reusable post-processing treatment applied to a Presence's
  rendered output. An Aura may be associated with a Seed, but is not owned by
  it and may be reused with other compatible Seeds and Presences.
- **Source revision** – a Git commit hash identifying the build that
  contained a Seed or Mutation's code. It is provenance only; Seed modules
  are immutable, so each Seed ID always resolves to its original code.
- **Artwork runtime** – the browser page that renders the current stable work.
- **Evolution** – a bounded, validated change to an artwork seed or its
  implementation between iterations.
- **Candidate** – a proposed change not yet promoted.
- **Stable version** – the last artwork state that passed checks and is
  displayed.
- **Control plane** – local service holding authoritative state and the API.
- **Remote studio** – local-network dashboard for observing and controlling.

## Naming convention

Use **Seed**, **Mutation**, **Imprint**, **Presence**, **Gene**,
**Environment**, and **Aura** consistently for their artwork-domain meanings
above. These terms form the project's biological, mystical, and
neural-network-inspired metaphor: apply them to abstract concepts and
domain-level modules or components when that improves the model's clarity.

Do not force the metaphor onto concrete UI elements or standard technical
terms. Names such as `input`, `slider`, `button`, `API`, and
`database` should stay plain. Prefer conventional names when an implementation
detail or external interface would otherwise become ambiguous.
