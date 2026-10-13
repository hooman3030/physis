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
approves plans and reviews every change before it is integrated. Agents update
docs, decisions, and instructions after each chat that yields durable
knowledge.

## Consequences

- Progress is slower per task but stays understandable and reviewable.
- Documentation and agent instructions stay close to current project reality.
- Extra commits for documentation upkeep are expected.
- Autonomy can be widened later through a new ADR.

## Alternatives considered

- **Fully autonomous agents on larger features:** rejected for now; too little
  experience with agent output and review.
- **Chat only, no agents:** rejected; the goal is to learn and use agentic
  workflows from the start.
