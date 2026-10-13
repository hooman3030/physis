# Roadmap

Detailed work lives in GitHub Issues. This page only names the outcomes.

## Milestone 1: First slice

One procedural piece renders fullscreen in a browser from a seed, with no AI
and no backend. See [ADR 0003](decisions/0003-first-slice-static-canvas.md).

Suggested issues:

1. Static page with a Canvas 2D sketch driven by a seed.
2. Seed controls (reproducible output for the same seed).
3. Verify performance on the presentation laptop (blocked: the laptop cannot
   boot yet; see the operations notes).

## Later (not planned in detail)

- Local control API and SQLite archive.
- Remote studio on the local network.
- Snapshots and versions.
- Optional hosted-AI evolution behind a provider adapter.
