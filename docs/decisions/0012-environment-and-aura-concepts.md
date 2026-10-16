# ADR 0012: Environment and Aura concepts

## Status

Accepted

## Context

Physis needs distinct concepts for influences that change a Presence's Genes
over time and for post-processing that changes how its rendered output appears.
The latter should be reusable across Seeds and Presences rather than belonging
exclusively to one Seed.

## Decision

- **Environment** names an adjustable influence on a Presence's Gene values
  over time. It changes the Presence's current values, not the Seed's authored
  defaults.
- **Aura** names a reusable post-processing treatment applied to a Presence's
  rendered output. A Seed may be associated with an Aura, but the Aura has an
  independent identity and can be reused with other compatible Seeds and
  Presences.
- An Aura is a presentation treatment, not a Gene or an Environment. It does
  not itself change Gene values.
- A Presence has an active Aura selection, synchronized with connected clients.
  Selecting a Seed starts with its declared default Aura, or Off if it has no
  default. Saving an Imprint captures the active Aura ID; selecting that
  Imprint restores its Aura.
- Three.js tone mapping is a separate renderer output setting, not an Aura
  effect. It is shared Presence state, starts at None for Three Seeds, and is
  captured and restored with Imprints. Legacy Imprints without a tone-mapping
  ID restore as None; non-Three Presences have no tone mapping.
- When an Imprint has no Aura ID, as with Imprints created before Aura capture
  is supported, use the Seed's default Aura or Off. This gives Imprint-specific
  Aura state precedence over the Seed default.
- For the current Three.js runtime, Aura processing is renderer-specific and
  should be applied by the runtime after the Seed creates its scene. Reuse is
  across compatible Seeds and Presences; cross-runtime portability is not
  implied.

This decision establishes the concepts and selection behavior. The effect
catalog and its editing experience remain implementation questions.

## Consequences

- Documentation uses **Environment** instead of **World** for Gene drift.
- An Aura can be selected independently of the Seed that first introduced or
  recommended it.
- Imprints preserve their own Aura selection, with a Seed default as fallback.
- Imprints also preserve Three.js tone mapping independently of Aura.
- Aura compatibility must be considered when selecting one for a Presence.

## Alternatives considered

- **World** for the Gene influence: rejected in favor of the more direct
  **Environment**.
- **Seed-owned post-processing:** rejected because it would prevent an Aura
  from being reused independently across Seeds and Presences.
