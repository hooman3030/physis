# Agentic workflow

Physis is developed with AI agents from the beginning, but every step stays
small, scoped, and human reviewed. The owner has used AI chat mostly for small
tasks; this workflow grows from that habit into agent work gradually.

## Principles

- **Human in control.** The human defines the goal, approves the plan, reviews
  the result, and decides what merges.
- **Small steps.** One agent task produces one reviewable change: a single
  issue, branch, and focused diff.
- **Plan before code.** For non-trivial work the agent proposes a short plan
  first and waits for approval.
- **Reviewable output.** Changes are first left as an uncommitted diff on a
  short-lived branch. After human review and explicit approval, they may be
  committed or opened as a pull request; never work directly on `main`.
- **Explicit approval action.** At the end of a task, the agent may present an
  approval action for the human to accept the current diff and authorize a
  commit. No approval action means no commit.
- **Honest validation.** Agents report what was run and what was skipped.
- **Docs follow chats.** See below.

## Task loop

1. **Frame** – the human states the goal in chat or an issue.
2. **Track** – find the matching GitHub Issue; create one only when the work
   is concrete and independently actionable. Keep unrelated ideas in the
   conversation until they are ready to be scoped.
3. **Plan** – the agent proposes steps, affected files, and open questions.
4. **Approve** – the human confirms or adjusts the plan.
5. **Execute** – the agent does one step on a branch and validates it.
6. **Review** – the human reads the diff and gives feedback.
7. **Record** – docs, decisions, instructions, and relevant issues are
   reconciled (below).
8. **Integrate** – commit, push, PR, and merge only when the human authorizes.

During execution and review, distinguish two kinds of quality work:

- **Required quality:** every change runs formatting and lint checks with
  `pnpm check`. Documentation-only changes (files under `docs/` or Markdown,
  MDX, and reStructuredText files elsewhere) skip typechecking, tests, and
  builds in CI. Any non-documentation change runs the full CI checks:
  typechecking, tests, and frontend and server builds as well as formatting
  and linting.
- **Design quality:** duplication, cohesion, boundary violations, and
  refactoring opportunities require contextual review. Agents inspect touched
  code and human reviewers decide whether a refactor belongs in the current
  change or should become a separate issue. Avoid fixed file-size or
  complexity thresholds unless the project develops a measured need for them.

## Keeping documentation current

After every chat that produces a lasting insight, the agent updates the repo
in the same working session:

| What came out of the chat                 | Where it goes                                       |
| ----------------------------------------- | --------------------------------------------------- |
| A durable architectural or process choice | New or updated ADR in `docs/decisions/`             |
| Changed understanding, scope, or design   | The relevant file in `docs/`                        |
| A new rule for how agents should behave   | `AGENTS.md` or `.github/instructions/`              |
| Actionable work or open questions         | GitHub Issue, created and kept current by the agent |

Chats that produce nothing durable need no changes. Doc updates are made as
their own small change, left uncommitted until the human has reviewed and
explicitly approved the diff.

At the end of a task, the agent should offer a clear approval action such as
“Review and commit current changes”. Selecting it authorizes the commit for the
reviewed diff only; declining or leaving it unanswered keeps the changes
uncommitted.

## Keeping the Project current

At task completion and after each merge, reconcile the issues relevant to that
work: the issue linked to the task or PR, issues explicitly mentioned by the
human, and issues whose scope or status the change made stale. Close work that
is verified complete (including when the owner confirms an outcome, even if it
was completed outside this repository); otherwise update its status, body, or
comments with the current blocker or finding. A linked issue that a merged PR
did not close should be checked rather than assumed complete.

Keep a clear in-progress item and next actionable item in the GitHub Project.
Do not bulk-edit unrelated issues or create a task just to fill a "next" slot:
create follow-up issues only for concrete, independently actionable work.
When the next direction has not been chosen, leave the backlog alone and ask
the owner to choose. Blocked work stays open and records the blocker; it need
not block other work.

Keep `docs/roadmap.md` and GitHub milestones aligned. Milestones describe
outcomes, with concrete work tracked as linked issues. Close a milestone only
when its exit outcome is verified and its work is complete; do not invent due
dates or treat unrelated blockers as gates.

This is a human-reviewed reconciliation step, not a rule to generate an issue
for every merge. Merge events alone do not establish whether work is complete
or what should come next. See
`.github/instructions/git-management.instructions.md` for the operational
rules.

## Boundaries for agents

- No application implementation unless the task asks for it.
- No push, merge, or Project configuration changes without authorization.
- Stop and ask when a decision would significantly affect the architecture.
- Never commit secrets or provider credentials.

## Growing autonomy

Start with chat-driven, single-step tasks. Widen scope (multi-file features,
background agents, parallel tasks) only after the human is comfortable with the
review loop, and record each widening as an ADR.
