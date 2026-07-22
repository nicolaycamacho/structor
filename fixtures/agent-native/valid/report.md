# Setup Report

## Versions

- Structor package: `0.2.4`
- Contract: `1.0.0`
- Plan schema: `1.0.0`
- Source revision: `090629a7b62ce346876edd71108458fd0ef446ca`

## Detected Facts

- `apps/web/package.json` declares package name `fixture-web` (evidence: `package-name`).

## Decisions And Provenance

- Consumer repository: `apps/web`, inferred from `apps/web/package.json` and confirmed.
- Project identity: `fixture-web`, inferred from `apps/web/package.json` and confirmed.
- Topology: `workspace`, inferred from `apps/web/package.json` and confirmed.
- Enabled clients: `codex`, explicitly selected.
- Existing guidance: `preserve`, explicitly selected.
- Evidence bundle: `evidence/setup/setup-fixture-001`

## Plan And Approval

- Plan hash: `sha256:9149a76163b57cb5fd989c68e28c1551d75ff8ab2d104a13c388a12e08ba3376`
- Approval receipt matches the plan hash.
- Hash binding does not prove whether a human or agent supplied approval.

## Changes

- Created `demo-structor/ai/context.md`.
- No files were replaced, preserved, or rolled back.

## Validation

- Command: `npm run validate` (cwd: `demo-structor`, status: `passed`)
- Required governance validation passed.
- Consumer tests were skipped because they were not approved in this fixture.

## Population

- Promoted the manifest-declared package name from `apps/web/package.json`.
- Architecture guidance remains review-required.

## Outcome And Readiness

- Execution outcome: `applied`
- Readiness: `ready_with_warnings`

## Risks And Recovery

- Architecture guidance still requires review.
- Review the evidence bundle and create a new plan and approval before retrying changed work.
