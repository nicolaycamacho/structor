# GitHub Safety Contract

Maturity is declared in the sibling manifest. Read `ai/contracts/README.md`
for the model and limits before relying on this starter as a project contract.

GitHub and other remote development platforms are external systems.

## Requirements

- Inspect local state before remote mutation.
- Do not push, force-push, merge, close issues, edit PRs, or change repository
  settings unless explicitly requested.
- Preserve user changes in dirty worktrees.
- Prefer dry-run or read-only inspection before high-impact operations.

## Validation

- `node scripts/validate-governance.mjs`
