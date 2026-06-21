# Structor Self-Harness Shared AI Guide

This folder holds canonical guidance for contributing to Structor itself.

## Scope

- Structor-specific contribution boundaries and review habits.
- Context routing for generator, template, schema, CLI, and docs changes.
- Validation expectations for issue work in the Structor source repo.

## Rules

- Structor is the Harness Engineering Framework.
- Structor is a generator, not a runner, orchestrator, agent runtime, PR
  automation system, dashboard, or external-service integration layer.
- Keep active templates in `../structor/template/**` generic and reusable.
- Keep shared guidance model-neutral. Keep model overlays and consumer
  entrypoints thin. Canonical generated policy belongs in
  `../structor/template/ai/*`.
- Generated self-harness content belongs in this repository or
  `../structor/contrib/self-harness/**`, not in the active generic templates.
- Issue work should be narrow, regression-driven, and validated before review.
- Use `npm run validate` in `../structor` as the default full local gate.
- Use `node scripts/validate-governance.mjs` here after changing self-harness
  guidance.

## Read Order

1. `./ai/context.md`
2. `./ai/HUB.md`
3. `./ai/PRODUCT.md`
4. `./ai/ARCHITECTURE.md`
5. `./ai/QUALITY.md`

Load additional files only when the task clearly needs them.
