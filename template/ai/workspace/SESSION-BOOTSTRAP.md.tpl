# Session Bootstrap

Before editing, confirm the current checkout and task boundary.

Use `ai/workspace/REPOS.md` when the repo owner or workspace role is unclear.

## Checks

1. Run `git status --short --branch`.
2. Confirm the target repo owns the files being edited.
3. Read `ai/context.md` and route through `ai/HUB.md`.
4. Check whether the task touches protected surfaces.
5. Choose validation from `ai/workspace/TEST-STRATEGY.md`.

## Worktrees

For Codex worktrees or copied consumer checkouts, run:

```bash
node scripts/check-worktrees.mjs --include-canonical
```

If a consumer checkout has stale harness pointers, repair it with:

```bash
node scripts/bootstrap-codex-worktree.mjs <checkout-path>
```
