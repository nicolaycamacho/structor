# {{PROJECT_NAME}} AI Harness Engineering Framework Repo Guide

This repository is the canonical AI Harness Engineering Framework for {{PROJECT_NAME}}.

## Read Order

1. `./README.md`
2. `./ai/AGENTS.md`
3. `./ai/HUB.md`
4. `./ai/context.md`
5. Topical docs selected by `./ai/HUB.md`

## Rules

- Treat `ai/*` as canonical harness policy.
- Keep model-specific files thin.
- Keep consumer repo implementation details in consumer repos.
- Do not add runner, polling, PR automation, live dashboards, orchestration UI,
  or external writes to this harness.
- Read-only generated Harness Cockpit views under `ai/views/*` are review
  artifacts, not workflow control surfaces.
- Validate harness changes with `node scripts/validate-governance.mjs`.
- Use `node scripts/bootstrap-workspace.mjs --dry-run` before installing or
  refreshing workspace-level or consumer repo entrypoints.
