# physis

Physis is a local-first, generative, AI-assisted digital art installation.
An older Linux laptop will render the artwork continuously and serve a
lightweight control interface to trusted devices on the local network.

The first implementation slice is a React and TypeScript web app using Vite+,
p5.js, pnpm, Vitest, Oxlint, and Oxfmt. The artwork renders independently of
AI and backend services.

## Development

```sh
pnpm install
pnpm dev
```

To connect the browser controls to the local archive and Presence API, run
`pnpm server` in a second terminal. The API binds to loopback on port `4317`;
the command builds and serves the browser bundle and API from that origin. In
development, Vite proxies API requests to the loopback service. The client
continues rendering in browser-only mode when the API is unavailable.
Press **C** for artwork controls and **A** for the Imprint archive; both panels
can remain open together, and **Escape** closes them. Selecting an archived
Imprint restores its saved parameters into the active Presence.

Remote access is opt-in and uses a private bind address configured in the
git-ignored `.env.local` file. Phones pair through a short on-screen PIN; the
installation credential stays on the laptop. See the
[local archive and API guide](docs/local-archive.md) for setup and the
[presentation laptop operations guide](docs/operations/presentation-laptop.md)
for network safety requirements.

Run the project checks with `pnpm check`, `pnpm typecheck`, `pnpm test -- --run`,
and `pnpm build`. VS Code workspace settings select the Oxc formatter and
enable format-on-save and Oxlint diagnostics. Install the recommended Oxc
extension when VS Code prompts you.

## Documentation

- [Vision and principles](docs/vision.md)
- [Abstract architecture](docs/architecture.md)
- [Development environment](docs/development-environment.md)
- [Agentic workflow](docs/agentic-workflow.md)
- [Roadmap](docs/roadmap.md)
- [Definition of done](docs/definition-of-done.md)
- [Glossary](docs/glossary.md)
- [Presentation laptop operations](docs/operations/presentation-laptop.md)
- [Architecture decisions](docs/decisions/README.md)
- [Initial AI conversation reference](docs/reference/initial-planning/)

## Planning

Actionable work belongs in GitHub Issues and the linked GitHub Project.
Durable architectural choices belong in `docs/decisions/`.
