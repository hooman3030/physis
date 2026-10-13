i want to create a digital, generative, ai powered art piece. i have an old laptop that i want to transform into display for that. i want it to run a web project or maybe just open the url and have it hosted somewhere else. but i prefer it to be run only on this laptop. but i want to have an api that i can monitor and configure the running web program via another device.

so my idea is, that this programm should have a seed of some kind, maybe a p5 instance with some graphics, maybe a three js scene, maybe raw shaders, or maybe video feed. these seeds i want to program myself with help of an agent/chat ai. then, running these seeds, the ai should slowly iterate over it. monitoring for errors and rolling back/correcting them in the background, so always a functioning snapshot/iteration of the artwork should be displayed. over hours and days new imagery should emerge.

i dont want to burn through tokens for this, i only want it to use openrouter/free. just maybe the laptop will be capable to run its own small local 8b ai model to do theses iterations.

i want to be able to inject prompts into the running system or give prompts together with the seeds. the running system should be able to save snapshots and i want to choose some of them to be saved as new seeds. so i have a gallery of sorts of all the creations. from another device these snapshots and seeds should be selectable and propmpts should be injectable. so my phone or another computer acts like a remote but as a second display as well.

this is quite the large task. so just analyze if this is possible, what would be the most difficult things and present an abstract architecture of the software needed for this. present a software stack you think is most suitable.
…

Worked for 1m 40s
A self-evolving AI art installation: feasibility and architecture
Yes, this is technically feasible, and the old laptop can be the entire installation: renderer, AI agent, API server, database, and image archive. Your phone or another computer would act as a remote control and gallery, connecting directly to the laptop over your local network.

The most important design decision is to separate the artwork that is currently being displayed from the AI process that creates new versions of it.

The display should keep running even when the AI produces broken code, a model is unavailable, or an experiment consumes too many resources. The AI should evolve the artwork; it should never be responsible for keeping the installation alive.

1. The living artwork

Runs continuously in a fullscreen browser. Renders the current stable version without depending on an AI request.

2. The evolution engine

Reads the seed, prompts, and previous iterations; proposes changes; tests candidate versions; promotes successful ones.

3. The memory and archive

Stores seeds, source code, prompts, screenshots, version history, logs, and selected works.

4. The remote studio

Lets you submit prompts, inspect the current work, select previous iterations, create branches from snapshots, and manage the evolution process.

The difficult part is not drawing graphics or serving an API. Those are established problems. The difficult part is making autonomous creative changes interesting, safe, reversible, and sustainable over days of unattended operation.

1. The hardest engineering problems
   A. Ensuring the artwork never goes down
   Critical
   An AI can generate code that compiles but crashes during rendering, freezes the GPU, exhausts memory, or produces a blank canvas.

Solution: maintain an immutable, known-good version. Every AI edit becomes a candidate in an isolated environment. Only promote it after automated checks pass. If the candidate fails, discard it and keep the previous version.

A repair attempt can be useful, but do not let the AI enter an unlimited repair loop. One repair attempt, followed by rejection, is a sensible starting policy.

B. Making evolution artistically meaningful
Critical
An LLM is not inherently a good generative artist. Without constraints, it may simply change colors, add visual clutter, rewrite working code unnecessarily, or repeatedly converge on similar ideas.

I would establish two levels of evolution:

Parameter evolution: change the composition, palette, particle count, movement, geometry, noise scale, and other exposed artistic controls.

Structural evolution: change the actual algorithms, shaders, rendering logic, or composition.

The first is reliable and cheap. The second is more expressive but considerably riskier. Let the system use both, with parameter evolution as its safe fallback.

C. AI quality, cost, and resource contention
High
Free hosted models are suitable for experimentation, but their available models, performance, and rate limits can change. OpenRouter's free tier currently advertises a 50-request daily limit in its pricing information; limits for free-model requests can also depend on account status.

OpenRouter
+1

A local model avoids API usage costs but trades off speed and code-generation quality. Running inference can also compete with the browser for RAM and CPU resources.

Solution: let the artwork render continuously, while the evolution engine works at a configurable, relatively low frequency. Set limits for generation duration, output length, retries, and daily requests.

D. Testing visual quality, not just code
High
A successful build does not prove that a work looks good. Automated tests can detect exceptions, missing assets, rendering failures, excessive resource usage, and blank screenshots. They cannot reliably determine whether a composition is aesthetically interesting.

Solution: combine technical acceptance tests with a snapshot gallery and human selection. Optionally use a vision model to flag suspicious images later, but it should not be a dependency for keeping the display alive.

E. Preserving creative lineage
Medium–high
A screenshot alone is not a seed. You need the executable source, its configuration, the prompt that led to it, the random seed, and ideally the parent version.

Solution: version every work immutably and model snapshots as branches in a lineage graph. That allows you to return to a favorite piece and evolve it in a new direction without destroying its history.

One particularly important distinction: reproducibility and continuous motion are separate things. A fixed random seed can reproduce an initial composition, while time, simulation state, and controlled randomness create an evolving image. For example, p5.js provides randomSeed() and noiseSeed() for repeatable random and noise sequences.

p5.js
+1

You should preserve those initial conditions as part of each work's metadata, rather than expecting every restart to recreate the exact same moment of an animation.

2. Proposed abstract architecture
   I would build this as a local-first generative art platform with an autonomous evolution worker, rather than one large AI agent that controls the whole application.

Old Laptop — Local Installation
Remote Dashboard
Local API + Control Plane
SQLite + Artwork Archive
Evolution Scheduler
Model Adapter
Local LLM
OpenRouter Free API
Isolated CandidateWorkspace
Build + Runtime + VisualChecks
Version Registry + Promotion
Fullscreen Chromium Kiosk
Current Stable Artwork
Phone / Another Computer
Local network
Pass
Fail
Activate version
The main components would work as follows.

1. The artwork runtime
   A fullscreen Chromium instance opens the current stable work. It does not need to know which AI model is running or whether an evolution cycle is underway.

The runtime should have a small interface for receiving configuration changes and, where practical, updating the artwork without reloading the page. For structural changes, the system should activate a new, validated version.

I would begin with p5.js for canvas-based, generative work, then add Three.js when you need 3D scenes or more complex GPU rendering. Raw GLSL shaders can come later. Supporting arbitrary video feeds from the beginning would add complexity without being necessary for the core system.

2. The evolution engine
   This is a scheduled worker, not an unbounded autonomous loop.

A typical iteration would be:

Select the current seed, an active prompt, and relevant previous versions.

Ask the configured AI model for a small change.

Save the proposed change in a separate workspace.

Build and run the candidate in isolation.

Check for runtime errors, rendering failures, and resource violations.

Promote the version if it passes; otherwise reject it and preserve the currently displayed work.

Record the outcome and capture a snapshot.

The evolution engine should return structured proposals or patches rather than unrestricted shell commands. It should not be able to rewrite its own backend, alter its tests, install arbitrary dependencies, or expose API credentials.

The AI should control the creative direction, not the infrastructure that keeps it running.

3. The control plane and archive
   The API would own the authoritative state:

Which seed and version are active.

Which prompts are queued, active, or completed.

Which model to use and how frequently to run it.

Whether evolution is paused or enabled.

Which snapshots have been selected as new seeds.

Logs, failures, resource metrics, and version history.

Use SQLite for structured metadata and the local filesystem for source code, builds, screenshots, and other larger assets. That is sufficient for an initial installation; you do not need a separate database server, cloud backend, or a complicated distributed architecture.

4. The remote studio
   The same laptop serves a dashboard at its local network address. Your phone can open it in a normal browser.

The dashboard should combine a preview of the artwork with controls for:

Sending prompts immediately or adding them to a queue.

Choosing a seed, branch, or previous snapshot.

Starting, pausing, or resuming evolution.

Configuring the AI provider and iteration schedule.

Comparing versions and promoting a selected snapshot into a new seed.

Viewing logs, errors, model availability, and system resource usage.

For a first version, use a normal web preview of the artwork and refresh the preview after significant changes. If you later want a faithful live mirror of the laptop display, add a low-rate screenshot stream or a synchronized secondary rendering instance.

The remote interface should be reachable only on your trusted local network, with authentication for control operations. Do not expose the API directly to the public internet. For access from outside home, use a private VPN rather than port-forwarding the control API.

3. Recommended software stack
   I would favor a TypeScript-based application with as few moving parts as possible. It needs to run reliably on an old machine, remain easy to modify, and be maintainable by you as the developer.

Component

Recommendation

Reason

OS

Lightweight Linux, e.g. Debian

Good fit for a dedicated, unattended installation

Browser

Chromium in kiosk mode

Fullscreen artwork with a conventional web rendering engine

Frontend

Vite + React + TypeScript

Dashboard, gallery, configuration, and development workflow

Generative graphics

p5.js first; Three.js as a second engine

Straightforward creative coding, with a path to 3D and GPU work

Backend/API

Node.js + TypeScript + Fastify

Local REST API, validation, logging, and control operations

Storage

SQLite + filesystem

Lightweight metadata store and versioned artwork archive

Local inference

llama.cpp + GGUF model

Local model served through an OpenAI-compatible API

Hosted inference

OpenRouter free models

Optional higher-quality generation without a paid inference budget

Candidate testing

Vite build checks + Playwright

Compilation, browser runtime checks, and screenshot capture

Process supervision

systemd on Linux

Automatic startup and recovery of services

Vite produces static production assets, which makes it suitable for serving each artwork version locally.

Vite
Playwright can record browser console messages, uncaught JavaScript errors, crashes, and screenshots, giving you a solid foundation for candidate validation.

Playwright

How the AI integration should work
Build a small model adapter with a common interface, for example:

interface ArtModel {
proposeChange(input: EvolutionInput): Promise<ArtProposal>;
repairFailure?(input: RepairInput): Promise<ArtProposal>;
}

Implement two providers behind it:

LocalModelProvider communicates with llama.cpp.

OpenRouterProvider communicates with OpenRouter's chat completions API.

llama.cpp supports an OpenAI-compatible server, so you can reuse much of the same client-side integration for both providers.

GitHub
+1

Keep the API keys and provider configuration on the laptop. The remote dashboard should never receive the OpenRouter key.

For inference, I'd use a local-first, cloud-when-needed policy:

Local model

Frequent, constrained parameter changes; simple code edits; error summaries.

OpenRouter free

Occasional structural changes, larger creative mutations, or attempts that need a stronger coding model.

No available model

Continue displaying the current stable artwork. Queue the next evolution attempt or wait for your next prompt.

A quantized 8B model is a plausible target, but whether your old laptop can handle it comfortably depends on its hardware. An 8B model can require around 5 GB just for quantized weights, before accounting for inference context, runtime overhead, and the browser.

GitHub

As a rough planning guide, 16 GB of RAM is a more comfortable starting point than 8 GB, but neither guarantees good inference speed or high-quality code generation. On a weak CPU, even an 8B model might make structural iterations frustratingly slow. A smaller model can still be useful for configuration-level changes.

Importantly, the LLM should never generate each animation frame. The artwork should run algorithmically in the browser, with AI intervention only when the evolution scheduler decides to make a change. This is the fundamental way to keep both resource usage and token consumption manageable.

4. How seeds, iterations, and snapshots should be represented
   I would treat each work as a small, versioned software project rather than a loose collection of JavaScript files.

A seed might contain:

seed-0042/
├── manifest.json
├── prompt.md
├── parameters.json
├── src/
│ └── sketch.ts
└── assets/
└── texture.png
manifest.json would hold the seed ID, rendering engine, parent version, random seed, creation time, and other metadata.

The source code defines the artwork's behavior. parameters.json defines its configurable qualities, such as palette, motion speed, density, and geometry. prompt.md captures the creative intent.

Each iteration produces a separate immutable version, for example:

seed-0042
├── version-001 Original work
├── version-002 Palette + motion change
├── version-003 New particle behavior
└── version-004 New compositional algorithm
A snapshot should link to the exact source version and capture the rendered image, prompt, timestamp, relevant parameters, and test results.

When you select a snapshot as a seed, the application should create a new branch from that version. The existing seed and its descendants remain unchanged.

That provides two separate, useful concepts:

Snapshot: a captured state of the artwork at a particular time.

Seed: a reproducible starting point from which new generations can evolve.

This design also allows you to compare siblings from the same parent, revisit older versions, and identify which prompts or code changes led to an especially compelling result.

5. Unattended operation and safety
   This is where I would spend more engineering effort than on the AI interface itself.

First, treat AI-generated code as untrusted. Do not allow a candidate to modify backend code, execute arbitrary shell commands, install dependencies, or access server secrets. Run candidate artwork in an isolated browser context, restrict its network access, and expose only the limited communication interface it needs.

Second, make promotion transactional. The current stable version remains active until all candidate checks succeed. A failed build, timeout, blank frame, JavaScript exception, or unacceptable resource spike must leave the active work untouched.

Third, separate the lifetime of the kiosk from the lifetime of the evolution worker. If the model crashes or the worker gets stuck, the browser should continue displaying its current work. If Chromium crashes, a supervisor should relaunch it and load the most recently approved version.

Finally, configure the laptop to stay awake, disable unnecessary sleep behavior, and monitor temperature, RAM, and renderer performance. A browser can encounter GPU failures or rendering-context loss independently of the AI process; recovery needs to exist at the rendering layer too.

Three.js Docs
+1

I would avoid Docker, external databases, multiple cooperating agents, and complicated job orchestration for the first version. They are not inherently wrong, but would increase the number of failure points before you have established that the creative loop works.

6. A realistic implementation sequence
   Phase 1 — The installation

Get a single p5.js seed running fullscreen on the laptop. Start it automatically on boot, prevent system sleep, and provide a basic local HTTP server. No AI integration yet.

Phase 2 — The remote studio

Add the dashboard, local API, SQLite database, screenshot capture, gallery, and seed selection. You can now manage the artwork from your phone before introducing autonomous changes.

Phase 3 — Safe evolution

Add one model provider, then the candidate workspace, build checks, Playwright testing, snapshots, and rollback. Initially require manual approval to activate a new version.

Phase 4 — Autonomous operation

Enable scheduled evolution with rate limits, an optional local model, bounded retries, automatic promotion of valid candidates, and resource monitoring.

Phase 5 — Creative branching

Add structural mutations, advanced shaders or 3D, richer version comparisons, prompt queues, and automatic branch creation from selected snapshots.

The manual-approval stage matters. It lets you observe the actual failure modes and the aesthetic tendencies of the models before allowing them to change an unattended installation without supervision.

Final recommendation
Build a local-first, version-controlled generative art studio, with an always-running browser renderer, a small TypeScript control server, a versioned filesystem archive, and a separately supervised AI evolution worker.

Start with p5.js, parameter-based evolution, SQLite, Playwright, and a single model adapter. Add structural code changes once the validation and rollback mechanisms are proven. Let the laptop host and render everything locally, while treating OpenRouter as an optional external inference service rather than a dependency of the artwork.

The one hardware-dependent question remains the local model: the old laptop's RAM, CPU, and GPU will determine whether an 8B model is practical or whether a smaller model is the better choice. The architecture itself does not depend on that decision.
