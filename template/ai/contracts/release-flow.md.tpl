# Release Flow Contract

Maturity is declared in the sibling manifest. Read `ai/contracts/README.md`
for the model and limits before relying on this starter as a project contract.

This contract defines harness release safety for {{PROJECT_NAME_CODE}}.

## Requirements

- Keep release decisions human-reviewed.
- Keep generated artifacts reproducible.
- Run governance validation before marking harness changes ready.
- Do not push, tag, publish, deploy, or mutate external services without
  explicit approval in the current task.

## Validation

- `node scripts/validate-governance.mjs`
