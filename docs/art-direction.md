# Art direction: World and Gene bias

Status: artist-authored direction; implementation and bias analysis remain
future work.

## World-driven Gene drift

A **World** is an environment that influences how the Gene values of the active
Presence change over its lifetime. The artist can adjust the strength of that
influence with a slider. The World changes the Presence's current values; it
does not rewrite the Seed's authored defaults.

The first increment uses randomized low-frequency-oscillator (LFO) shapes to
make Gene values drift over time. It does not use saved-Imprint bias. Drift
must respect each Gene's declared bounds, and an Imprint of the active work
captures its current Gene values as usual.

## Saved-Imprint-informed bias

A later increment may analyze saved Imprints as the artist's selection signal:

- **Benevolent** bias favors Gene values or configurations represented by
  saved Imprints.
- **Hostile** bias moves away from those values or configurations.

The analysis model is intentionally undecided. It needs to establish whether
to consider each Gene independently, relationships between Genes, or both.
Saving an Imprint is intended to signal that the result is worth keeping, but
whether all saved Imprints carry equal weight also remains open.

### Visualizing bias on Gene sliders

The artist would like Gene sliders to show where saved Imprints support values,
as a heatmap or gradient across the slider range. For example, if many saved
Imprints have background brightness at 0, that region could use a highlight
color while less-supported values use darker or secondary colors. Keep this
cue distinct from the current Presence value and slider thumb. The research
should determine how to represent sparse evidence, benevolent versus hostile
bias, and relationships between Genes without implying unsupported
independent per-Gene preferences.

This bias should eventually apply both to World-driven drift and to the Gene
randomize action. The randomize action should retain an unbiased option so its
current behavior remains available.

## Planned work

- [#44](https://github.com/hooman3030/physis/issues/44) adds the first,
  unbiased random-LFO World drift.
- [#45](https://github.com/hooman3030/physis/issues/45) researches an
  Imprint-informed bias model, including per-Gene versus relational analysis.
- [#46](https://github.com/hooman3030/physis/issues/46) applies that model to
  World drift.
- [#47](https://github.com/hooman3030/physis/issues/47) applies that model to
  Gene randomization.

These items are grouped under
[M6 — Artist-Directed Gene Evolution](roadmap.md#m6--artist-directed-gene-evolution).
