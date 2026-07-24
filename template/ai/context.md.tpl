# {{PROJECT_NAME}} Harness Context

## Current Focus

- Keep canonical AI engineering policy versioned in this harness.
- Make consumer repo work discoverable, bounded, and verifiable.
- Keep model overlays and consumer entrypoints thin.

## Known Fragile Areas

- Drift between model-specific overlays.
- Consumer repos duplicating or contradicting harness policy.
- Harness docs growing too large to route effectively.

## Consumer Repos

{{CONSUMER_REPOS_LIST}}

<!-- structor:populate:start -->
## Local Consumer Evidence

Run `structor populate --dry-run` from the workspace to preview deterministic
local starter-guidance updates. Review any populated evidence before relying on
it as durable policy.
<!-- structor:populate:end -->
