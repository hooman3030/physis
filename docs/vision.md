# Vision and principles

## Vision

Physis is a digital, generative artwork that can run unattended for hours or
days. It should produce evolving imagery from authored seeds, preserve the
lineage of its creations, and remain controllable from another device on the
same trusted network.

The presentation laptop is the installation: it renders the work, stores its
state and archive, and hosts the local control surface. A phone or another
computer acts as a remote studio rather than as a required part of the
rendering loop.

## Principles

1. **The artwork is independent of AI.** Rendering must continue if the
   network, a model provider, or an evolution attempt is unavailable.
2. **Stable work is never replaced blindly.** A candidate must be tested before
   it can become the displayed version; failures leave the current stable work
   active.
3. **Authored seeds remain meaningful.** AI may propose changes, but the
   artist defines the initial seeds, constraints, prompts, and selection of
   notable results.
4. **History is part of the artwork.** Preserve source, parameters, prompts,
   random seeds, snapshots, and parent relationships.
5. **Resource use is deliberate.** The presentation laptop has 4 GB RAM and
   Intel HD Graphics 520, so the runtime should avoid unnecessary services and
   heavyweight local inference.
6. **Local-first means private by default.** Control operations should remain
   on the trusted local network; remote access, if ever needed, should use a
   private VPN rather than public port forwarding.
7. **Evolution is bounded.** Iterations need limits for frequency, retries,
   runtime, output size, and external requests so unattended operation remains
   predictable.

## Scope for the first planning milestone

- Define the initial system boundaries and data concepts.
- Establish the laptop and development workflow.
- Decide the first rendering approach, with p5.js as the likely starting
  point.
- Leave implementation, provider selection, and visual-quality evaluation for
  explicit follow-up decisions.
