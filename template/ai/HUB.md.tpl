# {{PROJECT_NAME}} Harness Hub

This is the routing layer for the {{PROJECT_NAME}} engineering harness.

## Baseline

Always read:

- `./AGENTS.md` or the local entrypoint
- `./ai/AGENTS.md`
- `./ai/context.md`

## Routing

- Harness policy, bootstrap, validation, or model overlay changes:
  `./ai/HARNESS.md`, `./ai/HARNESS-ENGINEERING.md`, `./ai/QUALITY.md`
- Runner or automation questions:
  `./ai/WORKFLOW.md`, `./ai/RUNNER-SAFETY.md`,
  `./ai/RUNNER-READINESS.md`
- Contracts or repo boundaries:
  `./ai/contracts/README.md` and the matching contract doc
- Task template changes:
  `./ai/templates/README.md` and the matching template
- Review requests:
  `./ai/skills/README.md` and the matching review skill
- Repeated agent mistakes:
  `./ai/AGENT-GARBAGE-COLLECTION.md`

## Load Rules

- Load the smallest doc set that can answer the task.
- Add topical docs only when the task clearly needs them.
- Do not load every doc by default.
