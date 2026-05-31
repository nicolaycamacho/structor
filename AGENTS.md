# Structor Guide

Structor is a harness-engineering toolkit that generates repository-local
harnesses for consumer repos.

## Read Order

1. `./README.md`
2. `./harness.config.example.json`
3. `./template/ai/AGENTS.md.tpl`
4. `./template/ai/HUB.md.tpl`
5. The specific template or script needed for the task

## Rules

- Keep Structor generic and reusable.
- Keep canonical generated policy in `template/ai/*`.
- Keep model overlays and consumer entrypoints thin.
- Do not add runner or orchestration behavior to this template.
- Do not add project-specific product content to active templates.
- Validate with `npm run validate` after changing scripts, schemas, examples,
  or template files.

## GitHub Labels

When creating or updating GitHub issues and PRs, prefer the structured labels:

- Add one `type:*` label: `feature`, `bug`, `docs`, `test`, or `refactor`.
- Add one or more `area:*` labels: `cli`, `templates`, `schemas`,
  `validation`, `docs`, `contributor-workflow`, or `release`.
- Add one `risk:*` label: `low`, `medium`, or `high`.
- Add a `status:*` label only when the workflow state is known:
  `ready-for-agent`, `needs-fix`, `human-review`, `blocked`, or `pr-ready`.
- Add `priority: high` or `priority: low` only when priority is explicit.
