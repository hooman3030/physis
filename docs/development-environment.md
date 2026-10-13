# Development environment

## Roles of the machines

| Machine | Role |
| --- | --- |
| MacBook | Primary development, documentation, and AI-assisted authoring |
| GitHub repository | Source control, issues, project planning, and decisions |
| Old Linux laptop | Local artwork runtime, archive, API, and presentation display |
| Phone or other computer | Local-network remote studio and secondary view |

GitHub Codespaces may be tried later as an optional development environment.
It is not the artwork host and is not required for the local-first design.
Gists are not needed; project notes and experiments belong in this repository.

## Presentation laptop constraints

The recorded target hardware is:

- Intel Core i5-6200U, 2 cores / 4 threads, 2.3 GHz base;
- 4 GB RAM;
- Intel HD Graphics 520;
- Linux Mint is planned as the operating system.

These constraints favor browser-based procedural generation, a small local
service footprint, and persistent local state. A modern local 8B model is not
part of the baseline plan. Hosted AI can remain an optional influence, and the
artwork must function without it.

## Development principles

- Prefer a small number of independently understandable services.
- Keep rendering and control concerns separate.
- Test candidate artwork before promotion.
- Keep secrets and provider configuration on the laptop.
- Record architecture changes as decision records.
- Use GitHub Issues for actionable tasks and the project board for status,
  priority, and area metadata.

## Deferred choices

The following should be decided when implementation begins rather than
assumed now:

- exact Linux distribution and installation procedure;
- first frontend and API package versions;
- whether the first artwork uses Canvas 2D, p5.js, or WebGL directly;
- candidate isolation mechanism;
- authentication mechanism for the local dashboard;
- hosted model/provider and request budget.
