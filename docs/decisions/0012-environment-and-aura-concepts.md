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
- Aura selection and Three.js tone mapping are browser-local presentation
  preferences, persisted with the browser's local artwork settings. They are
  independent of Genes and are not shared through the control service.
- A Seed's declared default Aura is used only to initialize a browser that has
  no saved Aura preference. Subsequent Seed changes do not replace the saved
  preference.
- Selecting an Imprint restores its Genes only; it does not change Aura or
  tone mapping. Imprints do not capture either setting.
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
- Aura and tone mapping persist in the local browser settings, independent of
  Seed and Imprint selection. Different browsers can use different settings.
- Aura compatibility must be considered when selecting one for a Presence.
- Historical Imprint Aura and tone-mapping columns are retained for
  append-only archive compatibility, but are no longer read for display or
  written to new Imprints.

## Alternatives considered

- **World** for the Gene influence: rejected in favor of the more direct
  **Environment**.
- **Seed-owned post-processing:** rejected because it would prevent an Aura
  from being reused independently across Seeds and Presences.
