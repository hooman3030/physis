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
2. **Plan** – the agent proposes steps, affected files, and open questions.
3. **Approve** – the human confirms or adjusts the plan.
4. **Execute** – the agent does one step on a branch and validates it.
5. **Review** – the human reads the diff and gives feedback.
6. **Record** – docs, decisions, and instructions are updated (below).
7. **Integrate** – commit, push, PR, and merge only when the human authorizes.

## Keeping documentation current

After every chat that produces a lasting insight, the agent updates the repo
in the same working session:

| What came out of the chat | Where it goes |
| --- | --- |
| A durable architectural or process choice | New or updated ADR in `docs/decisions/` |
| Changed understanding, scope, or design | The relevant file in `docs/` |
| A new rule for how agents should behave | `AGENTS.md` or `.github/instructions/` |
| Actionable work or open questions | GitHub Issue, created and kept current by the agent |

Chats that produce nothing durable need no changes. Doc updates are made as
their own small change, left uncommitted until the human has reviewed and
explicitly approved the diff.

At the end of a task, the agent should offer a clear approval action such as
“Review and commit current changes”. Selecting it authorizes the commit for the
reviewed diff only; declining or leaving it unanswered keeps the changes
uncommitted.

## Keeping the Project current

The GitHub Project must always show where development is: what was done last,
what is in progress, and what is next. The agent maintains this automatically
as part of every task; the human should never have to ask. See
`.github/instructions/git-management.instructions.md` for the rules.

## Boundaries for agents

- No application implementation unless the task asks for it.
- No push, merge, or Project configuration changes without authorization.
- Stop and ask when a decision would significantly affect the architecture.
- Never commit secrets or provider credentials.

## Growing autonomy

Start with chat-driven, single-step tasks. Widen scope (multi-file features,
background agents, parallel tasks) only after the human is comfortable with the
review loop, and record each widening as an ADR.
