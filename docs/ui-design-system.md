# UI design system

The shared visual foundation lives in [`src/ui/styles.css`](../src/ui/styles.css)
and is imported by [`src/app/App.tsx`](../src/app/App.tsx). Extend these
foundations before introducing new component-specific colors, type sizes,
spacing, shapes, or surface treatments.

## Layers

Keep the system small and progress from foundations to compositions:

1. **Tokens** define the palette, typography, spacing, shape, borders, depth,
   and motion.
2. **Primitives** provide reusable visual behavior: `.surface`, the
   `.shape-*` classes, `.control`, `.button--primary`, `.button--quiet`, and
   `.range-control`.
3. **Compositions** arrange those primitives into panels, archive entries,
   overlays, and other UI features.

Use CSS classes for presentational primitives. Introduce a React component
when it owns meaningful semantics or behavior, not only to wrap a styled
element.

## Tokens

The root palette is the source of truth. In particular, change
`--color-canvas` to change the application canvas. Translucent surfaces,
borders, and interaction colors are derived from semantic palette tokens with
`color-mix()` so they remain coordinated with the base colors.

Use the existing token families for:

- **Color:** `--color-*`, `--border-*`, `--surface-*`, and `--shadow-*`.
- **Typography:** `--font-*` and `--text-*`.
- **Spacing:** `--space-*` for the shared rhythm.
- **Shape:** `--radius-*`, with `corner-shape: squircle` where supported.
- **Controls:** `--range-*` and the shared focus-outline tokens.

Keep raw palette literals in the root token declarations. For intentional
image treatments such as the lineage backdrop, derive tint and shadow values
from the corresponding semantic color token rather than repeating its RGB
channels.

## Typography

- Use Ubuntu Mono for the interface by default.
- Use Bitcount Single for semantic headings.
- Both web fonts load from Google Fonts with `font-display: swap`; monospace
  system fallbacks keep the UI readable when the fonts are unavailable.

## Surfaces and controls

- Apply `.surface` for the subtle border, translucent background, backdrop
  filter, and sheen. Pair it with `.shape-panel`, `.shape-card`, or
  `.shape-control` for the appropriate shared shape.
- Use `.control` on form controls and `.range-control` for Gene sliders.
- Native buttons use the shared accent treatment by default. Use
  `.button--primary` for the shared primary hover state and `.button--quiet`
  for compact secondary actions.
- Keep component-specific layout and artwork-specific treatments local, but
  build their colors, spacing, borders, and focus states from shared tokens.
- Preserve visible keyboard focus, disabled states, responsive behavior, and
  reduced-motion support when reusing or refining these patterns.
