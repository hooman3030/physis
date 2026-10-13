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
