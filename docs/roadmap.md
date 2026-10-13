# Roadmap

Detailed work lives in GitHub Issues. This page only names the outcomes.

## Milestone 1: First slice

One procedural piece renders fullscreen in a browser from a seed, with no AI
and no backend. The web app and two selectable seed modules are in place.
See [ADR 0003](decisions/0003-first-slice-static-canvas.md) and
[ADR 0004](decisions/0004-react-vite-plus-frontend.md) and
[ADR 0005](decisions/0005-artwork-display-and-controls.md).

Remaining work:

1. Add reusable controls that are hidden by default and toggleable in-art,
   including the active seed module identity ([issue #7](https://github.com/hooman3030/physis/issues/7)).
2. Verify performance on the presentation laptop ([issue #4](https://github.com/hooman3030/physis/issues/4)); blocked because the laptop
   cannot boot yet (see the operations notes).

## Later (not planned in detail)

- Local control API and SQLite archive.
- Remote studio on the local network.
- Snapshots and versions.
- Optional hosted-AI evolution behind a provider adapter.
