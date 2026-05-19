# Harness Quality

This scorecard tracks harness readiness. Keep grades evidence-based and update
them when validation or policy changes.

| Domain | Grade | Evidence | Enforced by | Blocking gaps |
| --- | --- | --- | --- | --- |
| Entrypoints | B | `AGENTS.md`, `CLAUDE.md` | `scripts/validate-governance.mjs` | Customize after initial generation |
| Context routing | B | `ai/HUB.md`, `ai/context.md` | Manual review | Add project-specific routing as needed |
| Contracts | B | `ai/contracts/*` | `scripts/check-contract-manifests.mjs` | Replace starter contracts with project contracts |
| Review skills | B | `ai/skills/*` | `scripts/check-review-skills.mjs` | Customize review inputs |
| Runner boundary | A | `ai/RUNNER-SAFETY.md` | Manual review | Keep runtime out of harness |
| Workspace bootstrap | B | `scripts/bootstrap-workspace.mjs`, `scripts/check-workspace.mjs` | `node scripts/check-workspace.mjs` | Run after consumer repos are cloned |
