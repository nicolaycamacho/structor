# Codex Hooks Contract

Codex hooks are local advisory guardrails.

## Requirements

- Hook config lives in `.codex/hooks.json`.
- Hook code lives under `scripts/hooks/`.
- Hooks are deterministic and local.
- Deny rules must include remediation and policy references.
- Hooks must not write files, call external services, or supervise long-running
  processes.
- Hooks are not a complete security boundary and do not replace sandboxing,
  permission controls, code review, CI policy, or secret management.

## Validation

- `node scripts/check-codex-hooks.mjs`
