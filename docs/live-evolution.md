# Live evolution requirements

Status: requirements captured from the artist; design not yet decided.
Related: [vision](vision.md), [architecture](architecture.md),
[ADR 0006](decisions/0006-local-control-service-and-archive.md),
[glossary](glossary.md).

## Intent

Watching the AI work is the point of the piece. The AI creates Mutations and
changes the running Presence while an observer follows what it does over time.
It may be slow. It will often fail, and it is expected to notice and correct
its own failures through recursion and feedback.

## Requirements

### Live mutation

- **L1.** Mutations are created while the installation is running, without a
  manual rebuild or restart.
- **L2.** A Presence can be updated live to run a new Mutation, not only
  receive new parameters.
- **L3.** Updates may be slow; they are bounded by iteration frequency, never
  applied per animation frame.

### Observing the process

- **O1.** The AI's process is viewable while it happens: the prompt, its
  reasoning or summary, the proposed change, check results, and the decision
  taken.
- **O2.** Attempts are recorded as a timeline, including failed and discarded
  ones, so the process can be followed and reviewed later.
- **O3.** The observer can see which Mutation is running and how it relates to
  its parent.

### Control by the artist

- **C1.** Save an interesting state: an Imprint of the current parameters, and
  promotion of a Mutation to a Seed.
- **C2.** Reset a Presence that went wrong, returning to a chosen stable Seed
  or Imprint.
- **C3.** Redirect the AI with a new prompt mid-run without losing history.
- **C4.** Pause or stop evolution at any time. The artwork keeps rendering.

### Automated health checks

Generative output is unstable: it can fill the screen, go blank, or stall.

- **H1.** Checks run on live output and on candidates before they replace the
  displayed work. Initial checks: blank/black output, saturated or fully
  covered output, runtime errors, frame-rate collapse, and resource limits.
- **H2.** A failed check produces feedback to the AI, for example "the screen
  has been black for 5 s; change something". It is not only a rollback.
- **H3.** Check thresholds are configurable per Seed.

### Recursion and self-correction

- **R1.** The loop is propose, run, check, feed results back, retry. Failure is
  an expected path.
- **R2.** Retries, depth, runtime, output size, and external requests are
  bounded (vision principle 7), so unattended operation stays predictable.
- **R3.** If the AI exhausts its retries, the system falls back to the last
  stable Seed or Imprint instead of showing a broken state.

### Safety and independence

- **S1.** The artwork keeps rendering if AI, network, or the control service is
  unavailable.
- **S2.** AI-generated code never rewrites the backend, runs shell commands,
  installs dependencies, or reads provider credentials. Mutation code runs only
  in an isolated browser context.
- **S3.** Hosted AI is optional; there is no local model on the 4 GB laptop.

## Conflicts with current decisions

These need an ADR before implementation. Do not build around them silently.

1. **Where Mutation code lives.** ADR 0006 treats Seeds and Mutations as
   immutable `.ts` modules in Git, bundled at build time, and states the
   archive never stores or runs executable source. Live mutation (L1, L2)
   requires code created at runtime, so it has to be stored somewhere other
   than the built bundle and loaded dynamically. Options: code text stored in
   SQLite or files in the archive directory, loaded into a sandboxed
   iframe or worker; or the service writes Mutation files and triggers a fast
   rebuild. ADR 0006 and the guarantee "executable source is never stored"
   would then be revised.
2. **Reproducibility.** The source revision is a Git hash. Runtime Mutations
   have no commit, so each needs its own identity, for example a content hash
   of its code.
3. **Archive growth.** Many failed attempts (O2) enlarge the archive. A
   retention policy is needed for failed attempts versus kept Mutations.

## Open questions

Answers so far are recorded in
[ADR 0007](decisions/0007-live-mutation-code-and-sandbox.md): restart with
crossfade, host-run probe, iframe with heartbeat watchdog, renderer-agnostic
runtime interface (defined in the ADR), and a process view that is hidden but toggleable on the
laptop and primarily in the remote studio. Still open:

- Which model produces the proposals, and what does the 4 GB laptop need to
  stay responsive while the observer view is open?
- Restricted API surface per runtime (decided in #20).

## Roadmap placement

This extends M4 (Safe Optional Evolution). The Mutation-storage ADR should
precede M4 design work, and it may need to land before #11 fixes the control API
shape.
