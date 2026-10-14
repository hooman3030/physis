---
name: commit-and-merge
description: 'Use when asked to commit, push, open a pull request, or merge work. Keep the Git workflow concise while preserving Physis review and CI safeguards.'
argument-hint: 'Commit and merge the current work or specified pull request'
---

# Commit and Merge

Complete a clearly requested Git workflow with minimal overhead. Follow
`.github/instructions/git-management.instructions.md` and `docs/agentic-workflow.md`;
this skill does not override their review gates.

## Procedure

1. Inspect `git status --short --branch`, recent commits, and the relevant
   remote once. Identify the intended changes, branch, target branch, and any
   existing pull request. Preserve unrelated work.
2. If the requested scope or target is ambiguous, ask one concise question.
   Otherwise, do not ask for approval of routine steps the user explicitly
   requested.
3. Stage only the intended changes, review the staged diff, and run
   `git diff --cached --check`. Do not amend an existing commit unless asked.
4. Follow the project review gate: leave changes uncommitted until the human
   has reviewed the diff and explicitly approved the commit. Then make a
   focused commit with a concise imperative subject and the required
   co-author trailer.
5. Push or open a pull request only when authorized and needed. Reuse an
   existing pull request when possible.
6. Check CI for the exact head commit first. Reuse passing results; run only
   the smallest documented validation needed for missing checks. Wait only for
   required pending checks. If a required check fails, stop and report it.
7. Before merging, confirm the pull request and target branch are
   unambiguous, required checks pass, required reviews are complete, and the
   human explicitly authorized that merge. Never bypass branch protection.
8. Report the commit, pull request and merge result, and exact validation
   commands/results briefly. State blockers plainly; omit routine narration.

## Guardrails

- A request to complete a clearly identified workflow authorizes its
  necessary steps only to the extent allowed by the project review gates.
- Never discard unrelated changes or use destructive Git operations to speed
  up the workflow.
- Do not rerun successful, current CI checks or skip required validation,
  review, or approvals.
