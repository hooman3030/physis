# Definition of done

A change is done when:

- it meets the issue's acceptance criteria and stays in scope;
- validation was run and reported honestly (commands and results);
- affected docs, ADRs, and instructions are updated;
- a human has reviewed the diff.

## Project commands

Run these from the repository root:

- `pnpm check` — Vite+ formatting, Oxlint, and type-oriented checks;
- `pnpm check:fix` — apply Oxfmt and Oxlint fixes;
- `pnpm typecheck` — strict TypeScript validation;
- `pnpm test -- --run` — run Vitest once;
- `pnpm build` — create the production bundle.

The VS Code workspace recommends the Oxc extension and configures Oxfmt as the
formatter with format-on-save and Oxlint diagnostics.
