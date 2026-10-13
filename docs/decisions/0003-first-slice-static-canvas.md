# ADR 0003: First slice scope: seeded canvas, no backend

## Status

Accepted, partially superseded by
[ADR 0004](0004-react-vite-plus-frontend.md). The implementation approach
(static HTML, plain JavaScript, Canvas 2D, no build step) was replaced by a
React, Vite+, and p5.js application. The scope decisions below still stand.

## Context

The architecture prefers Canvas 2D or p5.js, SQLite, and a local control plane,
but the first milestone needs none of the backend. Hardware is limited
(see ADR 0001).

## Decision

Build the first slice as a frontend-only page that renders one procedural piece
fullscreen, seeded deterministically, with no AI and no backend. Choose the
backend language and framework in a later ADR when the control API is needed.

Superseded by ADR 0004: the original wording required static HTML, plain
JavaScript, Canvas 2D, and no build step. The frontend now uses React,
TypeScript, Vite+, and p5.js.

## Consequences

- Fastest path to something visible and reviewable.
- The artwork has no runtime dependency on a backend or AI provider.
- Runtime performance on the presentation laptop is still unverified because
  the laptop cannot currently boot; the bundle is larger than the original
  plan assumed (about 1.4 MB minified, mostly p5.js).

## Alternatives considered

- **Plain Canvas 2D with no build step:** the original choice; replaced by
  p5.js and a build toolchain in ADR 0004.
- **Backend first:** premature; the artwork must render without it anyway.
