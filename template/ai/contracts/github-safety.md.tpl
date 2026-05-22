# GitHub Safety Contract

GitHub and other remote development platforms are external systems.

## Requirements

- Inspect local state before remote mutation.
- Do not push, force-push, merge, close issues, edit PRs, or change repository
  settings unless explicitly requested.
- Preserve user changes in dirty worktrees.
- Prefer dry-run or read-only inspection before high-impact operations.

## Validation

- `node scripts/validate-governance.mjs`
