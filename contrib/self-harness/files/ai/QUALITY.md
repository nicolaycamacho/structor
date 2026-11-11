# Structor Contribution Quality

Keep Structor changes small, evidence-backed, and easy to review.

Use the four independent evidence dimensions in `ai/READINESS.md` rather than
assigning contribution grades. Each recorded observation needs scope, revision
or bounded source evidence, observation date, method, result and limitations.
`node scripts/check-readiness.mjs` validates the record contract only.

- Structural validity: record the exact `npm run validate` result and snapshot.
- Verified knowledge: review source guidance, generic template boundaries and
  path-safety contracts against the named source evidence.
- Installation/adoption: require observed installation or use; contributor setup
  and configured hooks alone do not establish use.
- Observed effectiveness: require a bounded comparison; keep it unassessed until
  observed. Passing static checks proves neither adoption nor effectiveness.

No observation is supplied by this preset. Stable policy does not expire by
calendar age; recheck change-sensitive knowledge when the scoped source changes.

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
