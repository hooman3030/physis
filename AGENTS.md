# Agent guidance

## Project status

Physis is in the planning and repository-setup phase. Do not add application
implementation unless the task explicitly requests it.

## Source of truth

- Read `docs/` for curated project documentation.
- Read `.ai/` for the preserved source notes from the original planning
  conversation.
- Record durable architectural choices in `docs/decisions/`.
- Use GitHub Issues for actionable work rather than turning every idea into a
  document.

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
- Create commits when the requested work is complete and validated.
- Do not push, merge, close issues, or change GitHub Project configuration
  unless the user has requested or explicitly authorized that action.
