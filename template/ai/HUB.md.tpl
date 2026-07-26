# {{PROJECT_NAME}} Harness Hub

This is the canonical navigation layer for the {{PROJECT_NAME}} AI Harness
Engineering Framework.

## First Session

1. Read `./ai/context.md` and `./ai/PRODUCT-SUMMARY.md` to verify the project
   and repository facts.
2. If existing guidance was preserved, follow
   `./ai/tasks/populate-generated-harness.md` and review every proposed change.
3. Record the real work and validation flow in `./ai/WORKFLOW.md`.
4. Run `node scripts/validate-governance.mjs`, then use `./ai/READINESS.md`
   to identify the next manual review.

## Baseline

Always read:

- `./AGENTS.md` or the local entrypoint
- `./ai/AGENTS.md`
- `./ai/context.md`

## Routing

- Product or repository context: `./ai/PRODUCT-SUMMARY.md`, `./ai/context.md`
- Workflow or validation guidance: `./ai/WORKFLOW.md`, `./ai/READINESS.md`
- Preserved-guidance population: `./ai/tasks/populate-generated-harness.md`

{{EXPANDED_PROFILE_ROUTING}}

## Load Rules

- Load the smallest doc set that can answer the task.
- Add topical docs only when the task clearly needs them.
- Do not load every doc by default.
