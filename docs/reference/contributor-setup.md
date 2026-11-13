# Contributor Setup

The manual contributor setup path is for people who already cloned Structor
and want the local self-harness.

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm run setup:contributor -- --dry-run
npm run setup:contributor
```

The command generates or refreshes a sibling self-harness:

```text
workspace/
  structor/       # source repo contributors edit
  structor-self/  # generated Structor Self-Harness
```

## Safety Model

- The preset source lives in `contrib/self-harness/**`.
- Generated Structor-specific guidance is written to the sibling
  `structor-self` harness, not to active generic templates.
- The source repo is treated as the self-harness consumer repo.
- Source-repo pointer files are previewed before writes.
- Existing source `AGENTS.md`, `CLAUDE.md`, or other contributor entrypoints are
  skipped unless `--force` is passed.
- The manual path does not clone repositories, require GitHub authentication,
  push branches, open pull requests, or mutate external services.

## Validation

After setup:

```sh
npm run validate
cd ../structor-self
node scripts/validate-governance.mjs
node scripts/check-workspace.mjs
```

Use `--force` only after reviewing the preview and deciding to replace existing
source-repo pointer files.

## Toolchains And CI

The package declares Node.js `>=20` and npm `>=10`. Use a pairing supported by
npm's own Node engine requirements. Git and `tar` are needed for contributor
and packaged-artifact smoke checks. There are no runtime package dependencies.
The automatic `validate` workflow runs on pushes and pull requests with these
Linux reference toolchains:

| Node major | npm major | Full validation check name |
| --- | --- | --- |
| 20 | 10 | `full-validation (Node 20, npm 10)` |
| 22 | 10 | `full-validation (Node 22, npm 10)` |
| 24 | 11 | `full-validation (Node 24, npm 11)` |
| 24 | 12 | `full-validation (Node 24, npm 12)` |

CI selects the latest patch in each declared major and prints exact versions.
Node 24.22.1/npm 12.2.2 is the observed local reference. Other compatible pairs
above the declared minimums are not individually matrix-tested. Node 20 remains
covered; newer tooling does not replace that baseline.

For a clean checkout, run `npm ci` and `npm run validate`. The full gate includes
static checks, every Node behavioral test, profile/client template smoke, manual
contributor setup and clone/reuse smoke, and packaged CLI smoke. The package
smoke packs the actual source, validates a single-package npm array (npm 10/11)
or package-name-keyed object (npm 12) report, checks required paths in both the
report and tarball, installs that exact local tarball offline, and runs the
installed CLI's version, contributor preview, and harness generation with
resulting generated checks. It uses isolated temporary caches and synthetic
local repositories. It never publishes. Invalid or ambiguous reports fail
without guessing a tarball. Failure workspaces are retained for diagnosis.

`full-validation` manual dispatch reuses the same workflow and matrix. Ordinary
push/PR validation needs no manual dispatch. Matrix failures propagate; other
lanes finish to expose toolchain differences. Superseded runs are cancelled,
each validation lane has a 15-minute limit, and the PR-only `linked-issue` check
keeps its 2-minute limit.

### Required Checks

A repository administrator should require all four exact check names above and
`linked-issue` for `main` in branch protection or an active ruleset, with GitHub
Actions as the expected source. Select the checks after their first successful
PR run. Require branches to be up to date if integration with the current base
must be enforced. Keep these names stable; when changing the matrix, update
required checks deliberately so a retired name cannot block all merges.
The manual workflow is supplementary and is not a required-check substitute.

Workflow execution and merge protection are separate facts. At the 2026-11-13
inspection, the public repository's legacy branch-protection endpoint returned
`Branch not protected`; the effective active `Protect main` ruleset contained
only deletion and non-fast-forward restrictions. It required no status checks
or PR approvals. These settings were read successfully and were not changed.
Recheck live repository settings before claiming enforced protection; if access
is denied, report that access gap instead. A green workflow alone does not
establish that merges are protected.

This gate closes the behavioral/package slice of #121 through #146 and the
coordination spec #148. Version/tag/changelog integrity, publication provenance
and partial-release recovery remain in #121.
