# Definition of done

A change is done when:

- it meets the issue's acceptance criteria and stays in scope;
- validation appropriate to the change was run and reported honestly
  (commands and results);
- affected docs, ADRs, and instructions are updated;
- a human has reviewed the diff.

## Project commands

Run these from the repository root:

- `pnpm check` — Vite+ formatting and Oxlint; run for every change;
- `pnpm check:fix` — apply Oxfmt and Oxlint fixes;
- `pnpm typecheck` — strict TypeScript validation;
- `pnpm test -- --run` — run Vitest once;
- `pnpm build` — create the production bundle.
- `pnpm server:build` — bundle the standalone local control service.

CI runs `pnpm check` for every change. Documentation-only changes (files under
`docs/` or Markdown, MDX, and reStructuredText files elsewhere) skip
typechecking, tests, and builds. Changes to code, configuration, workflows, or
any other non-documentation file run all checks.

## Refactoring and maintainability

For code changes, CI verifies objective quality properties such as formatting,
linting, type correctness, tests, and successful builds. It does not
automatically decide whether a file is too large or an abstraction should be
extracted: those judgments depend on cohesion and domain boundaries and fixed
thresholds tend to create noisy exceptions.

For every change, review the touched code for:

- duplicated validation, state transitions, or serialization logic;
- functions or modules with multiple unrelated responsibilities;
- abstractions that leak across the browser, control API, archive, or evolution
  boundaries;
- tests that duplicate setup instead of using an existing focused helper.

Refactor when the issue is directly related to the change and the resulting
boundary is clearer. Record larger cross-cutting refactors as separate issues
instead of hiding them in feature diffs.

The VS Code workspace recommends the Oxc extension and configures Oxfmt as the
formatter with format-on-save and Oxlint diagnostics.
