# Test Strategy

## Harness-Owned Checks

- `node scripts/check-template-governance.mjs`
- `node scripts/check-task-template.mjs`
- `node scripts/check-knowledge-manifest.mjs`
- `node scripts/check-plans.mjs`
- `node scripts/check-review-skills.mjs`
- `node scripts/check-contract-manifests.mjs`
- `node scripts/check-html-views.mjs`
- `node scripts/validate-governance.mjs`

## Consumer-Owned Checks

Consumer repos own app-specific install, lint, test, build, browser, database,
and service checks.

## Evidence

Report exactly which commands ran, from which repo, and whether each passed,
failed, or was skipped with a reason.
