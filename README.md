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
