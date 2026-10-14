# Agent guidance

## Project status

Physis is in the planning and repository-setup phase. Do not add application
implementation unless the task explicitly requests it.

## Source of truth

- Read `docs/` for curated project documentation.
- Read [`docs/reference/initial-planning/`](docs/reference/initial-planning/)
  for the preserved notes from the initial AI planning conversation. These are
  read-only historical reference, not current requirements; curated `docs/`
  wins on conflict.
- Record durable architectural choices in `docs/decisions/`.
- Use GitHub Issues for actionable work rather than turning every idea into a
  document.
- Follow the domain naming convention in `docs/glossary.md`: use Seed,
  Mutation, Imprint, and Presence consistently for abstract artwork concepts.
  Metaphorical naming is welcome for domain-level modules and components, but
  keep concrete controls, standard technical concepts, and external API terms
  plain when that is clearer.

## Agentic workflow

Follow `docs/agentic-workflow.md` (see ADR 0002).

- Work in small, single-purpose steps; for non-trivial work propose a short
  plan and wait for approval before editing.
- Keep output human-reviewable: focused diffs on a branch, never on `main`.
- After any chat that yields a lasting decision, changed understanding, or new
  agent rule, update `docs/`, `docs/decisions/`, and `AGENTS.md` or
  `.github/instructions/` in a separate small change. Show the diff and wait
  for the human's explicit approval before creating a commit.
- Keep GitHub Issues and the Project current automatically, without being
  asked (standing authorization; see
  `.github/instructions/git-management.instructions.md`).
- Ask rather than assume when a choice affects architecture.

## Architectural constraints

- Keep the installation local-first and lightweight.
- The artwork must continue rendering independently of AI availability.
- Treat hosted AI as optional and do not plan around a local model on the
  4 GB presentation laptop.
- Do not expose control APIs or provider credentials to the public internet.

## Git management

- Use short-lived branches for implementation or documentation work; keep
  `main` stable.
- Follow the branch, commit, pull-request, merge, and GitHub workflow in
  `.github/instructions/git-management.instructions.md`.
- Never discard unrelated work or rewrite shared history.
- Create commits only after the human has reviewed the diff and explicitly
  approved the commit.
- Do not push, merge, or change GitHub Project configuration (fields, views,
  workflows) unless the user has requested or explicitly authorized that
  action. Creating, updating, and closing issues and setting item status for
  the work in progress is authorized; see the standing rule above.
