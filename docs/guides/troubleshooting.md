# Troubleshooting

This page covers common setup and validation problems grounded in current
Structor behavior.

## Wrong Working Directory

Run `structor init` from the parent workspace that contains your consumer repos.
Structor expects a sibling layout:

```text
workspace/
  project-structor/
  project-frontend/
  project-api/
```

If detection finds the wrong folders, reject the detected list and enter the
intended consumer paths manually.

## Existing Root Guidance

If a consumer repo already has root `AGENTS.md` or `CLAUDE.md`, Structor should
preserve that guidance as local source material after explicit consent or abort
setup. It should not silently replace, upload, interpret, or merge that content.

Use [populating a harness](populating-a-harness.md) after setup to review and
migrate still-relevant guidance.

## Setup Complete But Guidance Not Ready

This is expected after first run:

```text
setup_complete: true
guidance_ready: false
```

It means deterministic files and routing checks passed, but project-specific
guidance still needs reviewed population.

## Validation Failures

For Structor itself, run:

```sh
npm run check:ci
npm run validate
```

For a generated harness, run the generated validation scripts from the harness
repo, such as:

```sh
node scripts/validate-governance.mjs
node scripts/bootstrap-workspace.mjs --dry-run
node scripts/check-workspace.mjs
```

Use the failing check name to find the broken file or missing route. Do not
change CLI behavior or templates just to silence a docs mismatch.

## Generated Harness Routing Issues

Check that consumer root entrypoints point to the generated harness, then
follow the route through `ai/HUB.md`. Consumer entrypoints should stay thin and
should not copy canonical harness policy.

## Doctor

Use `structor doctor` to inspect local Structor workspace drift. It is an
inspection command, not a repair loop, runner, or workflow coordinator.
