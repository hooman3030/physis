# UI design system

The shared visual tokens live in [`src/styles.css`](../src/styles.css).
Keep component styling aligned with these foundations instead of introducing
new one-off colors, type sizes, radii, or surface treatments.

## Typography

- Use Ubuntu Mono for the interface by default.
- Use Bitcount Single for semantic headings.
- Both web fonts load from Google Fonts with `font-display: swap`; monospace
  system fallbacks keep the UI readable when the fonts are unavailable.

## Shape and surfaces

- Use the shared surface, card, and control radius tokens with
  `corner-shape: squircle`.
- Browsers without `corner-shape` support fall back to the matching
  `border-radius`.
- Glass surfaces share the same background and backdrop filter.
- Parameter sliders span the full width of their control.
