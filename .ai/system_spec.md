just for the record (and for architecture decisions) this is my laptops system info:
i5-6200 @2.3ghz, 4gb ram, intel hd graphics 520 (128mb)
Recorded for the architecture decisions. 🧪

Component

Specification

Architectural implication

CPU

Intel Core i5-6200U, 2 cores / 4 threads, 2.3 GHz base

Suitable for procedural generation and lightweight web services

RAM

4 GB

Keep the runtime lean; avoid heavyweight local AI models

GPU

Intel HD Graphics 520, 128 MB dedicated memory

Use browser-based WebGL; the GPU can use shared system memory

OS

Linux Mint (planned)

A reasonable choice for a stable, dedicated art display

Architecture constraints
Generative visuals: Canvas 2D or WebGL, with Three.js if 3D is needed.

AI generation: Prefer a remote inference API or lightweight local models only if practical. This machine is not a good candidate for modern local image-generation models.

Persistent artwork: Store the seed, configuration, and generation state locally.

Remote control: Run a small Node.js API server on the laptop, accessible from another device on your local network.

Display mode: Launch Chromium in kiosk mode, with automatic startup after boot.

Resource management: Avoid unnecessary background services and keep memory consumption low.

Key architectural recommendation: Separate the artwork engine from its control interface. The visual engine should continue running independently while the API accepts configuration changes, updates the seed, and triggers regeneration.

That gives you a self-contained generative art installation without asking this modest machine to perform computational miracles.

i think i will scrap the idea of local models with only 4gb of ram
Good decision. The laptop can be the canvas, not the artist's brain. Much less suffering for those 4 GB of RAM.

I'd adjust the architecture like this:

Old laptop — Linux Mint

Generative visuals · WebGL · Persistent seed

Local network API

Your phone / computer

Control parameters · Change seeds · Trigger events

Optional remote AI service

Image generation, embeddings, or text interpretation

What this changes
Visual generation stays local. Use seeded procedural algorithms, shaders, particle systems, noise functions, and mathematical patterns.

AI becomes optional. Call a hosted API only when you want AI-driven changes. The artwork should keep running if the internet disappears.

The seed becomes your source of continuity. Persist it alongside the parameters and version of the generation algorithm so the artwork can be reconstructed.

The API remains lightweight. A small Node.js server can expose controls without interfering with rendering.

One important distinction: you don't necessarily need AI to make the piece feel intelligent. A system that observes its own state, evolves over time, responds to events, and maintains visual memory can produce compelling emergent behavior without any model at all.

My recommendation: Build the generative engine first, then add remote AI as an optional influence rather than a dependency. That gives the installation autonomy instead of making it a glorified API client.
