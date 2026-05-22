# Plans

Plans hold multi-step governance work. Do not store runtime state here.

## Rules

- Active plans live in `ai/plans/active/`.
- Active plans must include status, goal, next step, and validation plan.
- Completed plans should move out of active work surfaces with evidence.
- Runtime logs, worktree state, and runner artifacts do not belong here.
