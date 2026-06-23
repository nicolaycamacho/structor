# Structor Self-Harness

This Repository-local AI Harness Engineering Framework guides work on the Structor source
repository. Structor is the Harness Engineering Framework that generates
Repository-local AI Harness Engineering Frameworks.

## Workspace

Expected local shape:

```text
workspace/
  structor/       # source repo contributors edit
  structor-self/  # generated self-harness
```

## Start Here

1. `./AGENTS.md`
2. `./ai/AGENTS.md`
3. `./ai/HUB.md`
4. `./ai/context.md`
5. The smallest topical doc selected by the hub

## Validation

- Validate this self-harness with `node scripts/validate-governance.mjs`.
- Validate workspace routing with `node scripts/check-workspace.mjs`.
- Validate Structor source changes from `../structor` with `npm run validate`.

Keep this repository as guidance and policy. Do not add runner behavior,
orchestration, PR automation, or external-service mutation here.
