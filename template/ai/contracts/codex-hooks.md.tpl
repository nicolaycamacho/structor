# Codex Hooks Contract

Codex hooks are local advisory guardrails.

## Requirements

- Hook config lives in `.codex/hooks.json`.
- Hook code lives under `scripts/hooks/`.
- Hooks are deterministic and local.
- Deny rules must include remediation and policy references.
- Hooks must not write files, call external services, or supervise long-running
  processes.

## Validation

- `node scripts/check-codex-hooks.mjs`
