---
description: 'Use when writing or refactoring TypeScript, TSX, frontend, server, API, archive, or test code in Physis.'
applyTo: ['src/**/*.ts', 'src/**/*.tsx', 'server/**/*.ts']
---

# TypeScript and architecture guidelines

- Read the relevant files in `docs/architecture.md`, `docs/decisions/`, and
  `docs/glossary.md` before changing an architectural boundary or domain
  concept.
- Preserve the local-first boundary: rendering must continue from the last
  known-good state when the control service, archive, network, or hosted AI is
  unavailable.
- Keep the browser runtime, control API, archive, and evolution concerns
  separated. Prefer existing domain types and helpers over parallel
  representations.
- Three Seeds that require WebGPU compute must declare that capability and
  rely on the runtime to report unsupported WebGL 2 fallback explicitly.
- Validate external input at the boundary, return explicit errors using the
  surrounding module's established error handling, and avoid broad catches or
  silent fallbacks.
- Keep immutable archive records immutable and make state transitions
  transactional where the existing archive API provides a transaction.
- Add or update focused tests for changed behavior, especially validation,
  persistence, failure paths, and API boundaries.
- Before finishing, inspect changed code for duplicated logic, unnecessary
  coupling, and files or functions that became difficult to understand. Extract
  shared logic only when the abstraction is stable and improves clarity; do
  not perform speculative or unrelated refactoring.
- Run the smallest relevant checks from
  [`docs/definition-of-done.md`](../../docs/definition-of-done.md), and report
  any skipped checks.
