# Harness Readiness

This file defines the post-generation readiness contract for the
{{PROJECT_NAME}} harness. Readiness is a gate with evidence, not a numeric score.

## Verdicts

- PASS: required machine gates pass and manual review domains are accepted.
- FAIL: any required machine gate fails.
- MANUAL REVIEW REQUIRED: machine gates pass, but project-specific guidance
  still needs human judgment.

## Required Machine Gates

| Gate | Command | Required evidence |
| --- | --- | --- |
| Governance validation | `node scripts/validate-governance.mjs` | Command exits 0 |
| Workspace bootstrap preview | `node scripts/bootstrap-workspace.mjs --dry-run` | Planned pointer writes are expected |
| Workspace bootstrap | `node scripts/bootstrap-workspace.mjs` | Command exits 0 or reports only intentional skips |
| Workspace check | `node scripts/check-workspace.mjs` | Command exits 0 |
| Codex hooks | `node scripts/check-codex-hooks.mjs` | Required only when Codex hooks are enabled |
{{EXPANDED_READINESS_GATES}}

## Manual Review Domains

- `ai/context.md` names the real project, repos, and operating assumptions.
- `ai/PRODUCT-SUMMARY.md` describes the product without unsupported claims.
- `ai/HUB.md` routes agents to the smallest useful context.
- `ai/WORKFLOW.md` records the real validation and handoff expectations.
{{EXPANDED_READINESS_DOMAINS}}

## Target Source Evidence

Use `structor doctor --config ./harness.config.json --target <checkout-path>`
to inspect one checkout. Add `--json` for the shared diagnostic result or
`--require-git-freshness` to require clean target and harness Git evidence that
is equal to or ahead of each configured upstream. Expanded harnesses also
provide `node scripts/check-worktrees.mjs --target <checkout-path>` with the
same options. Paths resolve from the current directory.

The report identifies physical roots, revisions, branch/upstream relationships,
dirty state, and enabled entrypoint/declared guidance fingerprints. Upstream
refs are cached: no live freshness is claimed and no fetch, pointer repair,
branch change, or checkout write occurs. Ordinary inspection supports non-Git
workspaces with evidence marked unavailable. The explicit Git gate fails on
missing or shallow history, missing upstream evidence, detached HEAD, dirty
state, unavailable dirty evidence, or behind/diverged sources. Configured Git
filters and indexed submodules leave dirty evidence unavailable to avoid
executing external filters during status collection. Unrelated worktrees are
not inspected in target mode. This evidence does not establish guidance quality
or agent behavior.

## Update Rule

When readiness changes, update the relevant command or manual-review evidence in
the same edit. Do not promote readiness based on intent alone.
