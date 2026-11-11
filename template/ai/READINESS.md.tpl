# Harness Readiness

This file defines the post-generation readiness contract for the
{{PROJECT_NAME}} harness. Readiness uses independent evidence, never an overall
letter grade or numeric score.

## Evidence Dimensions

This table is the canonical evidence record in both profiles. Generation leaves
every dimension unassessed. Passing generation, governance checks or hook
configuration never promotes knowledge, adoption or effectiveness.

| Dimension | State | Scope | Source evidence | Observed on | Method | Result | Limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Structural validity | unassessed | Not observed | Not observed | Not observed | Not observed | Not observed | Not observed |
| Verified knowledge | unassessed | Not observed | Not observed | Not observed | Not observed | Not observed | Not observed |
| Installation/adoption | unassessed | Not observed | Not observed | Not observed | Not observed | Not observed | Not observed |
| Observed effectiveness | unassessed | Not observed | Not observed | Not observed | Not observed | Not observed | Not observed |

Use exactly one row per dimension. State is `unassessed` or `recorded`.
`unassessed` requires all six evidence fields to remain `Not observed`.
`recorded` means an observation was documented, including negative or inconclusive
results; it is not a success verdict. Supply all six fields:

- Scope: the bounded repository, files, client and task/sample covered.
- Source evidence: a revision plus relevant paths, or a bounded source artifact
  such as a saved command transcript, reviewed source excerpt or comparison log.
- Observed on: the observation date as a real `YYYY-MM-DD` calendar date.
- Method: how the observation was made, including commands or review procedure.
- Result: the observed outcome, keeping uncertainty explicit.
- Limitations: what was not checked and what cannot be concluded.

Keep each field on one line without pipe characters. Do not use unfinished
markers or placeholders for recorded claims. `scripts/check-readiness.mjs`
checks this record contract only, not truth, source freshness or agent behavior.
It neither executes methods nor updates records.

Structural validity covers deterministic local checks at the observed snapshot.
Verified knowledge requires comparison with the scoped source evidence.
Installation/adoption needs explicit observation of the named installation or
use, distinguishing configured surfaces from actual use. Observed effectiveness
needs a bounded comparison and may remain unknown even when adoption is observed.

## Knowledge Revalidation

Keep stable policy (authority boundaries, conventions and accepted decisions)
distinct from change-sensitive source knowledge (paths, commands, interfaces and
repository facts). Recheck affected knowledge when its source changes or drift
is found. Record the new source and limitations; do not expire all guidance by
calendar age. An old observation date alone neither invalidates stable policy
nor proves source knowledge is current.

## Verdicts

- PASS: required machine gates pass and manual review domains are accepted,
  within the recorded scope only; this does not establish adoption or effectiveness.
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

## Optional Bounded Manual Comparison

This protocol is guidance only; Structor runs no agents or model evaluations.

1. Before observation, choose a small fixed task sample, source revision,
   client/model/settings, time bound and rubric (correctness, convention fit,
   review corrections and effort). Record these in a local comparison log.
2. Compare equivalent baseline and harness-assisted attempts under the same
   conditions; record ordering and learning effects. Use only authorized tasks.
3. Record both outcomes, failures, corrections and effort against the preset
   rubric. Keep installation/use observations separate from comparative results.
4. Put the bounded log reference, date, method, result and limitations in the
   relevant row. Report confounders and sample limits; inconclusive is valid.

No comparison or live-agent evaluation is required for generation or static
validation. This protocol does not supply adoption or effectiveness evidence.
