# Release Flow Contract

This contract defines harness release safety for {{PROJECT_NAME_CODE}}.

## Requirements

- Keep release decisions human-reviewed.
- Keep generated artifacts reproducible.
- Run governance validation before marking harness changes ready.
- Do not push, tag, publish, deploy, or mutate external services without
  explicit approval in the current task.

## Validation

- `node scripts/validate-governance.mjs`
