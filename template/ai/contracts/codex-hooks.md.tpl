# Codex Hooks Contract

Codex hooks are local advisory guardrails.

## Requirements

- Hook config lives in `.codex/hooks.json`.
- Hook code lives under `scripts/hooks/`.
- Hooks are deterministic and local.
- Hook config must contain only the expected generated events, entries, and
  commands.
- Deny rules must include remediation and policy references.
- Hooks must not write files, call external services, or supervise long-running
  processes.
- Hook code must not import or call synchronous file mutation APIs,
  write-capable streams, or write-capable file opens.
- Hook validation must scan hook scripts for banned mutation tokens before
  importing or executing hook code.
- Hooks are not a complete security boundary and do not replace sandboxing,
  permission controls, code review, CI policy, or secret management.

## Validation

- `node scripts/check-codex-hooks.mjs`
