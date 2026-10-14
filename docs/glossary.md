# Glossary

- **Seed** – a pre-built, self-contained artwork module that can render a
  fullscreen piece. A seed has an identity and implementation; it is not just
  a text value or random number.
- **Mutation** – a child source-code revision created by changing a Seed.
  Selected Mutations may be promoted to Seeds.
- **Imprint** – an immutable capture of an artwork's parameters (and random
  seed when applicable) at a point in time. It references the Seed and source
  revision used to render it and may have a parent Imprint. It is data, not a
  screenshot.
- **Presence** – an artwork currently running in the browser, using a
  particular Seed/source revision and active Imprint.
- **Source revision** – an identifier, such as a Git commit or build ID, for
  Seed or Mutation code. It identifies code but does not archive the code
  itself.
- **Artwork runtime** – the browser page that renders the current stable work.
- **Evolution** – a bounded, validated change to an artwork seed or its
  implementation between iterations.
- **Candidate** – a proposed change not yet promoted.
- **Stable version** – the last artwork state that passed checks and is
  displayed.
- **Control plane** – local service holding authoritative state and the API.
- **Remote studio** – local-network dashboard for observing and controlling.

## Naming convention

Use **Seed**, **Mutation**, **Imprint**, and **Presence** consistently for
their artwork-domain meanings above. These terms form the project's
biological, mystical, and neural-network-inspired metaphor: apply them to
abstract concepts and domain-level modules or components when that improves
the model's clarity.

Do not force the metaphor onto concrete UI elements or standard technical
terms. Names such as `input`, `slider`, `button`, `parameter`, `API`, and
`database` should stay plain. Prefer conventional names when an implementation
detail or external interface would otherwise become ambiguous.
