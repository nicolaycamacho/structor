# ADR 0002: Store Harness Configuration In Generated Harness

## Status

Accepted

## Context

`structor init` used to persist `harness.config.json` at the workspace root,
generate the harness, and then print manual bootstrap commands. That left two
problems:

- setup could report success before workspace entrypoints were actually
  installed and verified
- a loose workspace-root config was fragile when the parent workspace was not a
  repository and the generated harness was the durable artifact users kept

We also needed a way for paths such as `output.path` and consumer repo paths to
stay workspace-relative after moving the durable config into the generated
harness.

## Decision

- New `structor init` runs persist `harness.config.json` inside the generated
  harness repo.
- Init-authored configs include explicit `workspace.root` semantics so
  workspace-relative topology paths keep resolving correctly even though the
  config file now lives inside the harness repo.
- `structor init` does not print `Structor setup complete.` until consumer
  entrypoints, workspace entrypoints, `node scripts/validate-governance.mjs`,
  and `node scripts/check-workspace.mjs` have completed successfully.
- Existing manual `structor generate --config <path>` flows remain supported for
  workspace-root configs that do not declare `workspace.root`.

## Consequences

- The generated harness becomes the durable home for both policy and the init
  recipe that produced it.
- Failed init attempts can clean up files created during that same setup
  transaction without depending on a loose workspace-root config.
- Tooling that looks for a config from the workspace should prefer the explicit
  harness-local config when it is the only unambiguous match.
