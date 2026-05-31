# Structor Contribution Quality

Keep Structor changes small, evidence-backed, and easy to review.

| Domain | Grade | Evidence | Enforced by | Blocking gaps |
| --- | --- | --- | --- | --- |
| Product boundary | A | `README.md`, `CONTEXT.md`, `CONTRIBUTING.md` | Manual review | Keep runner behavior out of Structor core |
| Generic templates | A | `template/**`, `scripts/generated-harness-contract.mjs` | `npm run validate` | Do not add Structor-specific content to active templates |
| Path safety | A | `scripts/lib.mjs`, `test/init-harness.test.mjs` | `npm test` | Add exploit-shaped regressions for write-path changes |
| Contributor setup | B | `contrib/self-harness/**`, `scripts/setup-contributor.mjs` | Manual setup validation | Keep future bootstrap out of this path |
| Issue work | A | Live issue scope and regression evidence | Review | Avoid opportunistic refactors |
| Readiness | B | `ai/READINESS.md`, `scripts/check-readiness.mjs` | `node scripts/validate-governance.mjs` | Preserve the manual-review state for skipped source entrypoints |

## Completion Checklist

- The diff is scoped to the issue.
- Generic templates remain reusable for consumer projects.
- Source-repo pointer files are previewed and existing files are skipped unless
  force is explicit.
- `npm run validate` passes in `../structor`.
- `npm run setup:contributor -- --dry-run` previews generated self-harness and
  source pointer writes.
- `npm run setup:contributor` generates or refreshes `../structor-self`.
- `node scripts/validate-governance.mjs` passes in `../structor-self`.
- `node scripts/check-workspace.mjs` passes in `../structor-self`.

## Review Posture

Lead with risks, regressions, and missing evidence. Summaries come after
findings. When there are no findings, say that directly and name any remaining
test gaps.
