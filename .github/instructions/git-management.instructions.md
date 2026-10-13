---
description: "Use when managing Git branches, commits, rebases, pushes, pull requests, merge requests, merges, GitHub Issues, milestones, or Projects for physis."
name: "Physis Git Management"
---

# Git and GitHub workflow

## Before changing Git state

- Inspect `git status --short --branch`, recent commits, and the relevant
  remote before branching, committing, rebasing, or merging.
- Preserve unrelated user changes. Do not reset, checkout, clean, stash, amend,
  or delete work that was not created for the current task.
- Use non-interactive commands and disable pagers.
- Check the target branch before changing it. Keep `main` stable and
  up-to-date.

## Branches

- Work on a short-lived branch for changes beyond a trivial one-file fix.
- Use descriptive names such as:
  - `docs/architecture-decision`
  - `feat/seed-gallery`
  - `fix/api-validation`
  - `research/rendering-engine`
- Branch from the current target branch and verify the starting point.
- Do not force-push shared branches. If history rewriting is genuinely
  necessary, stop and request explicit approval.
- Delete branches once their work is merged. GitHub deletes the remote head
  branch automatically when a pull request merges; after a merge, run
  `git fetch --prune` and delete the matching local branch. Squash-merged
  branches are not detected by `git branch --merged`, so confirm the work is
  on the target branch before using `git branch -D`.
- Never delete a branch with unmerged work or one that was not created for the
  current task.

## Commits

- Leave changes uncommitted until the human has reviewed the diff and
  explicitly approved creating a commit.
- Make focused commits that represent one coherent change.
- Use imperative, concise subjects with the appropriate type, for example:
  `docs: record rendering decision` or `fix: reject invalid seed input`.
- Inspect the staged diff before committing:
  `git diff --cached --check` and `git diff --cached`.
- Never commit secrets, tokens, generated artifacts, local machine state, or
  credentials.
- Include this trailer in commits unless the user explicitly opts out:
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- Do not amend an existing commit unless the user explicitly requests it.

## Pull requests and merge requests

- GitHub calls them pull requests; use “merge request” only when the hosting
  platform uses that term.
- A PR/MR should have a clear title, a concise summary, linked issues, scope
  notes, validation results, and any follow-up work.
- Keep documentation-only, setup, and implementation changes separate when
  that improves reviewability.
- Never claim validation that was not run. Report skipped checks and why.
- Before opening a PR/MR, verify the branch is based on the intended target,
  the worktree is clean, and the diff contains only the requested change.
- Prefer `--force-with-lease` over `--force`; normally avoid both.
- Pushing a branch or opening a PR/MR requires user authorization unless the
  user explicitly asked for that complete workflow.

## Merging

- Merge only with explicit user authorization for the specific PR/MR.
- Before merging, confirm required checks, review status, target branch, and
  whether the branch is up to date.
- Prefer the repository's configured merge strategy. Do not bypass branch
  protection, required reviews, or failed checks.
- After a merge, verify the resulting target branch and report the merge
  commit or resulting commit range.

## GitHub Issues, milestones, and Projects

- Use Issues for actionable work, research questions, bugs, and follow-up
  tasks; keep durable architectural decisions in `docs/decisions/`.
- Search for existing issues before creating duplicates.
- Link implementation PRs/MRs to issues using the repository's supported
  closing syntax when closing is intended; do not close an issue accidentally.
- Use milestones for meaningful outcomes, not individual subtasks.
- Keep Project custom fields such as status, priority, and area in the GitHub
  Project. Do not duplicate them in issue bodies unless useful for context.
- The user has standing-authorized the agent to keep Issues and the Project
  current without being asked. At the start of work, make sure an issue exists
  for it (search first) and set its Project status to In Progress. When
  scope, blockers, or findings change, update the issue body or add a
  comment. When work is merged or verified done, close the issue (via the PR's
  closing keyword where possible) and set status to Done. Keep a clear Next
  item (Todo/Ready) so the Project shows what was done last, what is in
  progress, and what comes next. Blocked work stays open with the blocker
  stated in the issue.
- Still require explicit authorization for Project configuration changes
  (fields, views, workflows), deleting issues, milestones, assigning other
  people, and pushing, merging, or opening PRs.
- If `gh` lacks the `project` scope, say so and ask the user to run
  `gh auth refresh -s project`; update issues meanwhile and report that the
  Project status could not be set.

## Completion report

Report:

- branch and target branch;
- commits created;
- files or issues changed;
- validation commands and results;
- whether anything was pushed, opened, merged, or left for user approval.
