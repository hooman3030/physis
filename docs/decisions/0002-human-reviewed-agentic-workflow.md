# ADR 0002: Human-reviewed, step-by-step agentic workflow

## Status

Accepted.

## Context

The project owner has used AI chat extensively for small tasks but not agents.
Physis should use agentic development from the start without losing
understanding of, or control over, the codebase.

## Decision

Use AI agents for scoped, single-step tasks with a plan-approve-execute-review
loop, described in [the agentic workflow](../agentic-workflow.md). The human
approves plans and reviews every change before it is integrated. Changes remain
uncommitted until the human reviews the diff and explicitly approves creating
a commit. Agents update docs, decisions, and instructions after each chat that
yields durable knowledge.

At the end of a task, the agent may present a clear approval action for the
human to authorize committing the reviewed diff. Without that approval, the
changes remain uncommitted.

## Consequences

- Progress is slower per task but stays understandable and reviewable.
- Documentation and agent instructions stay close to current project reality.
- Extra documentation changes are expected, but commits require explicit human
  approval after review.
- A simple approval action can make the commit step convenient without making
  it automatic.
- Autonomy can be widened later through a new ADR.

## Alternatives considered

- **Fully autonomous agents on larger features:** rejected for now; too little
  experience with agent output and review.
- **Chat only, no agents:** rejected; the goal is to learn and use agentic
  workflows from the start.
