# Structor Self-Harness Context

## Current Focus

- Make Structor contribution work easier to route, bound, and validate.
- Preserve the distinction between Structor as a Harness Engineering Framework
  and Harness Engineering as the practice.
- Keep the future one-command contributor bootstrap behind the quality of this
  self-harness guidance.

## Source Repo

- `../structor/package.json` owns CLI scripts and local validation commands.
- `../structor/bin/structor.mjs` owns the public CLI surface.
- `../structor/scripts/init-harness.mjs` renders generated harnesses from
  configuration and templates.
- `../structor/scripts/lib.mjs` owns config resolution and path safety.
- `../structor/template/**` is the active generic generated-harness surface.
- `../structor/contrib/self-harness/**` owns this self-harness preset and
  Structor-specific generated guidance.

## Boundaries

- Structor scaffolds harness repositories; it does not run agents.
- Structor must not poll sessions, automate pull requests, auto-merge, mutate
  GitHub, or become a runner.
- Active templates must stay generic for consumer projects.
- Model overlays and consumer entrypoints stay thin and route to canonical
  harness policy.
- Source-repo pointer files should be previewed and skipped when they already
  exist unless an explicit force path is used.

## Validation Defaults

- In `../structor`, run `npm run validate` for the full local gate.
- For focused generator changes, also run the relevant `npm test` coverage.
- In this self-harness, run `node scripts/validate-governance.mjs`.
- After setup or pointer changes, run `node scripts/check-workspace.mjs`.
