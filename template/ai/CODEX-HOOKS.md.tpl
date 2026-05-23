# Codex Hooks

Codex hooks provide lightweight local guardrails for `{{PROJECT_NAME}}`.

## Scope

- Hooks may emit context or deny clearly unsafe actions.
- Hooks must be deterministic, local, and dependency-free.
- Hooks must not write files, call networks, run subprocess orchestration, or
  mutate remote services.
- Hooks are local guardrails, not a complete security boundary. They complement
  sandboxing, permission controls, code review, CI policy, and secret
  management.

## Validation

Run:

```bash
node scripts/check-codex-hooks.mjs
```

The hook contract lives in `ai/contracts/codex-hooks.md`.
