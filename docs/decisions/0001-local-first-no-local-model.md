# ADR 0001: Local-first installation without local inference

## Status

Accepted.

## Context

Physis should run as a self-contained artwork on an older laptop and remain
useful when the network or an AI provider is unavailable. The recorded machine
has 4 GB of RAM and Intel HD Graphics 520. A local model would compete with
the browser renderer and other runtime services, while a hosted model can
consume tokens and depends on availability and rate limits.

## Decision

Keep rendering, persistence, and the control API local to the presentation
laptop. Treat hosted AI as an optional, bounded influence on evolution. Do not
make local model inference part of the baseline architecture.

The artwork runtime must continue independently of AI. Authored procedural
generation, seeds, parameters, and snapshots are the foundation; AI can be
added later behind a provider adapter.

## Consequences

- The installation can continue displaying work without internet access.
- Resource usage on the laptop stays focused on rendering and control.
- Hosted-model cost, quotas, and availability remain operational concerns.
- The project needs explicit limits for requests, retries, and evolution
  frequency.
- A future local model can still be evaluated as an optional experiment
  without changing the core runtime boundary.

## Alternatives considered

- **Run a local 8B model:** rejected for the baseline because the hardware has
  only 4 GB RAM and the model would compete with the display runtime.
- **Make hosted AI mandatory:** rejected because provider failure would then
  threaten the continuity of the artwork.
- **Host the artwork elsewhere:** rejected for now because the preferred
  installation is self-contained on the old laptop.
