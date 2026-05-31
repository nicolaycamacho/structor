# Roadmap

Structor is a harness-engineering toolkit for generating repository-local AI
engineering harnesses. It is a local generator, not a runner or hosted product.

## Current Open-Source Core

- Local `init` and `generate` flows for repository-local harnesses.
- Deterministic templates for Codex and Claude Code guidance.
- Conservative path, template, schema, and governance validation.
- Optional local consumer entrypoint installation.
- MIT licensing so teams can generate, modify, and use harness artifacts inside
  private or commercial repositories.

## Near-Term Launch Readiness

- Keep public documentation clear about local-only behavior and non-goals.
- Add small, deterministic public-release hygiene checks.
- Improve contributor setup for Structor itself without turning it into a
  runner or workflow orchestrator.
- Keep examples and documentation focused on harness generation and validation.

## Future Possibilities

- Commercial policy packs, private templates, tailored rollout support, or
  hosted services may be licensed separately.
- Deeper consumer-repo scan and review flows may help teams draft
  project-specific harness content from local evidence.
- Diagnostic tooling may help users inspect existing harness workspaces for
  drift, stale pointers, and validation gaps.

## Non-Goals

- No agent runner, polling loop, dashboard, auto-merge system, or repair daemon.
- No telemetry, LLM calls, external service mutation, or hosted workflow in the
  open-source generator.
- No consumer implementation logic or deployment automation.
- No license change away from MIT in this launch slice.
