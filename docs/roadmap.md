# Roadmap

Milestones are outcome-based planning groups, not hard gates: work may proceed
when a deferred validation or hardware blocker does not affect it. Each
milestone links to its GitHub tracking page, where actionable work and status
live. No target dates are set.

## M0 — Foundation

**Complete.** Project principles, initial architecture, and the development
environment are documented. The owner confirms the development setup works.

Issues: [#1](https://github.com/hooman3030/physis/issues/1),
[#2](https://github.com/hooman3030/physis/issues/2),
[#3](https://github.com/hooman3030/physis/issues/3).

[GitHub milestone M0](https://github.com/hooman3030/physis/milestone/1)

## M1 — First Slice

Deliver the browser-only artwork slice: registered seeds, hidden reusable
controls, and parameter editing with persistence. No backend or AI is required.

**Exit outcome:** the first slice works in the browser, and its performance
has been measured on the presentation laptop. The laptop check is currently
deferred because it cannot boot; this does not block later software milestones.

Issues: [#5](https://github.com/hooman3030/physis/issues/5),
[#6](https://github.com/hooman3030/physis/issues/6),
[#7](https://github.com/hooman3030/physis/issues/7) are complete;
[#4](https://github.com/hooman3030/physis/issues/4) remains open and deferred.

See [ADR 0003](decisions/0003-first-slice-static-canvas.md),
[ADR 0004](decisions/0004-react-vite-plus-frontend.md), and
[ADR 0005](decisions/0005-artwork-display-and-controls.md).

[GitHub milestone M1](https://github.com/hooman3030/physis/milestone/2)

## M2 — Local Runtime and Archive

Add a lightweight local control API and persistent archive for artwork state,
Seed and Mutation lineage, and Imprints. Keep rendering available when the
API, database, network, or AI provider is unavailable.

**Exit outcome:** the active Presence can be controlled locally and restored
after restart; Seeds, Mutations, and Imprints can be stored and retrieved with
their lineage intact.

1. Define the local API, authoritative state, and archive design
   ([#14](https://github.com/hooman3030/physis/issues/14)).
2. Persist artwork Imprints and source lineage
   ([#10](https://github.com/hooman3030/physis/issues/10)).
3. Add the local artwork control API
   ([#11](https://github.com/hooman3030/physis/issues/11)).

[GitHub milestone M2](https://github.com/hooman3030/physis/milestone/3)

## M3 — Local-Network Remote Studio

Provide a phone- and desktop-friendly dashboard for observing and controlling
the installation on a trusted private network (Wi-Fi preferred, with private
Ethernet allowed if excluding it adds operational complexity). Reuse the
existing control surface where practical. Do not expose control APIs to the
public internet.

**Exit outcome:** an authenticated local-network client can inspect the active
work, browse archive state, change supported controls, and see diagnostics
without interrupting fullscreen rendering.

1. Decide the authentication and LAN boundary
   ([#12](https://github.com/hooman3030/physis/issues/12)).
2. Build the remote studio
   ([#15](https://github.com/hooman3030/physis/issues/15)).
3. Add Presence pause/resume controls
   ([#34](https://github.com/hooman3030/physis/issues/34)).

[GitHub milestone M3](https://github.com/hooman3030/physis/milestone/6)

## M4 — Safe Optional Evolution

Add a bounded candidate workflow. Proposed work is isolated, validated, and
explicitly promoted or rejected; a failed candidate never replaces stable
artwork. Hosted AI may propose changes behind an adapter, but is optional and
not part of the rendering loop. Local model inference is not in the baseline.

**Exit outcome:** candidate failures leave the stable work untouched, every
result has recorded lineage and validation, and evolution is bounded by
approved resource and request limits.

1. Make the Seed type renderer-agnostic with runtime adapters
   ([#24](https://github.com/hooman3030/physis/issues/24)).
2. Specify candidate isolation and validation limits
   ([#20](https://github.com/hooman3030/physis/issues/20)).
3. Select a hosted provider and request budget, if desired
   ([#13](https://github.com/hooman3030/physis/issues/13)).
4. Implement candidate validation and promotion
   ([#17](https://github.com/hooman3030/physis/issues/17)).
5. Add the optional hosted-AI provider adapter
   ([#19](https://github.com/hooman3030/physis/issues/19)).

Live, observable mutation with automated health checks and self-correcting
feedback loops is specified in [live-evolution.md](live-evolution.md). Its
requirements supersede the Git-only Mutation storage in ADR 0006; the proposed
replacement is [ADR 0007](decisions/0007-live-mutation-code-and-sandbox.md).

[GitHub milestone M4](https://github.com/hooman3030/physis/milestone/5)

## M5 — Unattended Installation

Prepare the presentation laptop for reliable unattended operation: safe OS
setup, automatic startup, fullscreen display, process recovery, and visible
diagnostics. Verify sustained resource use on the target hardware.

**Exit outcome:** after a verified installation and boot, the stable artwork
starts automatically, recovers predictably from process failure, and remains
maintainable without public internet exposure.

1. Establish a safe boot and OS recovery plan
   ([#16](https://github.com/hooman3030/physis/issues/16)).
2. Prepare and install the presentation operating system
   ([#21](https://github.com/hooman3030/physis/issues/21)).
3. Configure unattended fullscreen startup and recovery
   ([#18](https://github.com/hooman3030/physis/issues/18)).

The M1 laptop performance check ([#4](https://github.com/hooman3030/physis/issues/4))
remains open but is not a prerequisite for M2–M4 work.

[GitHub milestone M5](https://github.com/hooman3030/physis/milestone/4)

## M6 — Artist-Directed Gene Evolution

Add an adjustable World that drifts the active Presence's Genes over time,
then evaluate saved-Imprint-informed bias for both World drift and Gene
randomization. Keep implementation focused on artist-facing behavior; the
bias model must be researched before it is applied.

**Exit outcome:** the artist can control World-driven Gene drift, and can
optionally use a documented benevolent or hostile saved-Imprint-informed bias
for both World behavior and Gene randomization without losing the unbiased
randomize option.

1. Add randomized LFO World drift without bias
   ([#44](https://github.com/hooman3030/physis/issues/44)).
2. Define a saved-Imprint-informed bias model
   ([#45](https://github.com/hooman3030/physis/issues/45)).
3. Apply the model to World drift
   ([#46](https://github.com/hooman3030/physis/issues/46)) and Gene
   randomization ([#47](https://github.com/hooman3030/physis/issues/47)).

See [Art direction: World and Gene bias](art-direction.md).

[GitHub milestone M6](https://github.com/hooman3030/physis/milestone/7)
