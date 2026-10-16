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
- For the current Three.js runtime, Aura processing is renderer-specific and
  should be applied by the runtime after the Seed creates its scene. Reuse is
  across compatible Seeds and Presences; cross-runtime portability is not
  implied.

This decision establishes the concepts and their relationship. Persistence,
Seed defaults, and whether an Imprint captures an Aura remain implementation
questions.

## Consequences

- Documentation uses **Environment** instead of **World** for Gene drift.
- An Aura can be selected independently of the Seed that first introduced or
  recommended it.
- Aura compatibility must be considered when selecting one for a Presence.

## Alternatives considered

- **World** for the Gene influence: rejected in favor of the more direct
  **Environment**.
- **Seed-owned post-processing:** rejected because it would prevent an Aura
  from being reused independently across Seeds and Presences.
