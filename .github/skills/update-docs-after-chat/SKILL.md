---
name: update-docs-after-chat
description: Capture lasting outcomes of the current chat in the repo.
disable-model-invocation: true
---
Review this chat and record only what is durable:

- architectural or process choices -> ADR in `docs/decisions/` (update index);
- changed understanding or scope -> the relevant `docs/` page;
- new agent rules -> `AGENTS.md` or `.github/instructions/`;
- actionable work -> propose GitHub Issues, do not create them.

Keep edits minimal, on a short-lived branch, in one small docs commit. If
nothing is durable, say so and change nothing.
