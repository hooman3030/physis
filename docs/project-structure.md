# Project structure

Use folders to make ownership and boundaries clear, not to anticipate every
possible feature. Keep the application at the repository root; do not add
packages or workspaces just for organization.

## Browser application

- `src/main.tsx` is the browser entry point; `src/app/` composes the app.
- `src/ui/` contains React components and styles. Shared behavior-bearing
  primitives live in `src/ui/primitives/`; group domain compositions by
  responsibility and keep domain/runtime logic outside the UI.
- `src/seeds/types.ts` and `src/seeds/registry.ts` hold shared Seed contracts
  and registration. Put each bundled Seed at
  `src/seeds/<runtime>/<seed-id>/seed.ts`; keep runtime-specific Seed types
  with that runtime. Add a runtime directory when it has an implementation.
- Three Seed authors should follow [`three-seeds.md`](three-seeds.md) for the
  WebGPU renderer, TSL imports, Gene uniforms, and playback contract.
- `src/runtimes/` contains rendering adapters. React components should depend
  on the runtime boundary, not renderer-specific implementation details.
- Keep cross-cutting non-UI modules outside `src/ui/`. Add a named folder when
  related modules form a clear boundary; avoid generic `components/` or
  `utils/` dumping grounds.

## Server and tests

- `server/` is the control service, grouped by boundaries such as `api/` and
  `archive/`. Keep server-only dependencies out of the browser app.
- Tests live under `tests/frontend/` or `tests/server/` and mirror the
  relevant source areas. Update Vitest discovery when moving tests.

## When changing structure

Keep `src/` roots for entry points, declarations, and established shared
modules—not new UI components or tests. Avoid one-off folders except where a
domain object has its own identity, as with each Seed. Update this guide and
the relevant decision record when changing a lasting boundary.
