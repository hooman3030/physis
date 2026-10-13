# ADR 0004: React frontend with Vite+

## Status

Accepted

## Context

The first slice needs to be a real web application rather than a plain static
HTML page. The project should support React, TypeScript, p5.js artwork, fast
unit tests, and consistent editor and CI checks while remaining lightweight.

## Decision

Use a root React and TypeScript application built with Vite+. Use pnpm for
package management, Vitest for tests, and p5.js in instance mode for the first
artwork surface. Use Vite+'s Oxlint and Oxfmt integrations for linting and
formatting. The VS Code workspace selects the Oxc extension as the formatter,
enables format-on-save, and enables Oxlint diagnostics.

Represent each seed as a pre-built `ArtworkSeed` module with an identity,
display label, and fullscreen p5 sketch factory. The first module uses a small
FNV-1a-derived utility internally to convert its stable module identity into a
number for p5's seeded random and noise functions. This keeps reproducibility
inside the module without confusing a module with a text value.

Keep the first app at the repository root. A later local API can become a
workspace package when it is needed; the first slice does not justify that
boundary yet.

## Consequences

- The project has one toolchain for development, checks, tests, and builds.
- VS Code and terminal/CI workflows use the same formatter and linter.
- The p5 lifecycle is owned by a React component while sketch logic remains
  independent of React's render cycle.
- The initial browser bundle is intentionally simple; bundle splitting can be
  considered when the artwork grows.

## Alternatives considered

- ESLint and Prettier: familiar, but duplicates the unified Vite+ toolchain.
- A pnpm workspace with `apps/web/`: useful once the API exists, but extra
  structure for the first web-only slice.
- A custom PRNG dependency: unnecessary while p5's seeded random APIs cover
  the initial reproducibility requirement.
