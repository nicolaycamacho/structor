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
