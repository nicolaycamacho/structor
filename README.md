# Structor

> Experimental. Early infrastructure for harness engineering. The API,
> generated layout, and config shape may change.

Structor is a local harness-engineering toolkit. It generates a
repository-local AI engineering harness: a versioned policy layer for Codex,
Claude Code, and similar agents to share context routing, contracts, task shape,
review expectations, and validation guidance.

Structor is a generator, not a runtime. It creates plain local files and
validators; it does not run agents, coordinate sessions, open pull requests,
host services, call LLM APIs, install packages, collect telemetry, or mutate
external systems.

## Quick Start

Run Structor from the workspace folder that contains your consumer repos:

```sh
npx @structor-dev/cli init
```

During local development from the parent workspace containing the `structor/`
clone, use:

```sh
node ./structor/bin/structor.mjs init
```

`structor init` is local-only and deterministic. It detects sibling repos,
previews the planned setup transaction, asks before writing, and reports setup
completion only after deterministic local gates pass.

## First-Minute Safety

- No network calls, LLM calls, telemetry, package installs, or remote service
  mutation during `init` or `generate`.
- Existing root agent guidance is not silently deleted, uploaded, interpreted,
  or automatically merged.
- The planned guidance takeover flow asks for consent before replacing existing
  root `AGENTS.md` or `CLAUDE.md` entrypoints.
- Preserved guidance remains consumer-local source material for a later reviewed
  migration.
- Setup completion and guidance readiness are separate states: Structor can
  finish deterministic setup while still requiring project-specific guidance
  migration.

## Generated Output

Running `init` creates a generated harness repo as a sibling of your code:

```text
workspace/
  my-app-structor/        # generated harness: policy, contracts, validation
  my-app-frontend/        # your code
  my-app-backend/         # optional second repo
```

Inside the generated harness, canonical policy lives under `ai/`, while thin
Codex and Claude entrypoints route agents into that policy. Optional consumer
entrypoints route from each code repo back to the generated harness.

## Learn More

- [Init and setup manual](docs/INIT.md)
- [Guidance safety and post-init migration](docs/GUIDANCE-SAFETY.md)
- [Contributor setup](docs/CONTRIBUTOR-SETUP.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)

## Boundaries

Structor is intentionally narrow. Runner behavior, polling, pull request
automation, live dashboards, auto-repair loops, CI shepherding, hosted control
planes, and workflow orchestration belong outside the core generator.

The generated harness starts with structured starter guidance. Structor does not
infer complete project conventions, architecture, contracts, or validation
expectations from consumer repo code during deterministic setup. Those
repo-specific details belong in the post-init guidance migration and review
step.

Structor is MIT-licensed so teams can generate, modify, and use harness
artifacts inside private or commercial repositories. Commercial policy packs,
private templates, tailored rollout support, or hosted services may be licensed
separately.
