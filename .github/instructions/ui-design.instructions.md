---
description: 'Use when creating or refining Physis browser UI and styles.'
applyTo:
  - 'src/ui/**/*.ts'
  - 'src/ui/**/*.tsx'
  - 'src/ui/**/*.css'
  - 'src/app/**/*.tsx'
---

# Physis UI design

- Read [`docs/ui-design-system.md`](../../docs/ui-design-system.md) before
  changing UI styling.
- Reuse tokens from `src/ui/styles.css`. Keep raw palette literals in the root
  token declarations; derive translucent backgrounds, borders, and effects
  from semantic tokens instead of repeating RGB values in component rules.
- Follow the small token → primitive → composition hierarchy. Use the shared
  `.surface`, `.shape-*`, `.control`, `PrimaryButton`, `.button--quiet`,
  `.button--compact`, and `.range-control` patterns before adding another
  visual variant. `PrimaryButton` provides click wipe-and-refill feedback by
  default; disable it only when a state-driven animation already handles the
  same interaction.
- Prefer CSS classes for presentation-only elements. Add React components
  when they own useful semantics or behavior; do not wrap elements only to
  forward styles.
- Preserve interaction behavior, keyboard focus, disabled states, responsive
  layouts, and reduced-motion behavior unless a task explicitly changes them.
- Avoid adding a styling dependency unless a concrete requirement cannot be
  met clearly with the existing CSS.
- For UI changes, run the relevant project checks and visually inspect the
  affected screen at desktop and narrow widths, including reduced motion when
  relevant. Report what was actually checked.
