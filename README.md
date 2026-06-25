# Structor

> Experimental. Early infrastructure for Harness Engineering. The API,
> generated layout, and config shape may change.

Structor is a local Harness Engineering Framework. It generates a
Repository-local AI Harness Engineering Framework: a versioned policy layer
where Codex, Claude Code, and similar agents can share context routing,
contracts, task shape, review expectations, and validation guidance.

Structor is a generator, not a runner. It creates plain local files and
validators; it does not run agents, coordinate sessions, open pull requests,
host services, call LLM APIs, install packages, collect telemetry, or mutate
external systems.

## Quick Start

Run Structor from the workspace folder that contains your consumer repos:

```sh
npx @structor-dev/cli init
```

`structor init` detects sibling repos, asks confirmation-oriented questions,
previews the planned setup transaction, writes a generated harness only after
approval, installs or verifies thin agent entrypoints, and reports setup
completion after deterministic local gates pass.

It creates a sibling generated harness repo:

```text
workspace/
  my-app-structor/        # generated harness: policy, contracts, validation
  my-app-frontend/        # consumer repo
  my-app-backend/         # optional consumer repo
```

Inside the generated harness:

```text
ai/                 canonical policy and guidance
AGENTS.md           thin Codex entrypoint -> routes into ai/
CLAUDE.md           thin Claude Code entrypoint -> routes into ai/
scripts/            generated validation and workspace checks
```

## Guides

- [Docs index](docs/index.md)
- [Quickstart](docs/guides/quickstart.md)
- [Setting up a harness](docs/guides/setting-up-a-harness.md)
- [Populating a harness](docs/guides/populating-a-harness.md)
- [Troubleshooting](docs/guides/troubleshooting.md)
- [What Structor is](docs/concepts/what-structor-is.md)
- [Harness vs runner](docs/concepts/harness-vs-runner.md)
- [Commands](docs/reference/commands.md)
- [Configuration](docs/reference/configuration.md)
- [Generated files](docs/reference/generated-files.md)
- [Contributor setup](docs/reference/contributor-setup.md)
- [FAQ](docs/faq.md)

## Boundaries

- Structor setup is local-only and deterministic.
- Existing root `AGENTS.md` and `CLAUDE.md` guidance is not silently deleted,
  uploaded, interpreted, or merged.
- Preserved guidance remains consumer-local source material until a later
  reviewed migration.
- Generated harness `ai/*` is the canonical policy layer inside generated
  projects.
- `docs/*` is the canonical Structor user guide corpus.

See [harness vs runner](docs/concepts/harness-vs-runner.md) and
[using Structor as an orchestrator](docs/anti-patterns/using-structor-as-orchestrator.md)
for the product boundary.

## Contributors

See [contributor setup](docs/reference/contributor-setup.md) for the local
Structor contributor path.

Useful project references:

- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
