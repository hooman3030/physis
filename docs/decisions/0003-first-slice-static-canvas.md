# ADR 0003: First slice as a static Canvas 2D page

## Status

Proposed. Confirm before implementation starts.

## Context

The architecture prefers Canvas 2D or p5.js, SQLite, and a local control plane,
but the first milestone needs none of the backend. Hardware is limited
(see ADR 0001).

## Decision

Build the first slice as a static HTML page with plain JavaScript and Canvas 2D,
seeded deterministically, with no build step and no backend. Choose the backend
language and framework in a later ADR when the control API is needed.

## Consequences

- Fastest path to something visible and reviewable.
- Minimal dependencies on the presentation laptop.
- p5.js can still be adopted later if plain Canvas becomes limiting.

## Alternatives considered

- **p5.js from the start:** convenient, but adds a dependency before it is
  needed.
- **Backend first:** premature; the artwork must render without it anyway.
