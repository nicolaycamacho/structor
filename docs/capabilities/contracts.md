# Contracts

Contracts describe important project boundaries in a generated harness. They
help agents understand interfaces, ownership, validation expectations, and
review requirements before changing code.

Structor ships template structure and validators for contract manifests. The
project still owns the actual contract content after harness population.

Use contracts for stable boundaries, not for transient task notes. Honest
incomplete inventory is useful: record what is known, bound its scope and name
unknowns instead of presenting an unverified map as established policy.

## Maturity

The canonical maturity model and per-level agent behavior live in the generated
`ai/contracts/README.md`, sourced from
[`template/ai/contracts/README.md.tpl`](../../template/ai/contracts/README.md.tpl).
It covers inventory, flow mapping, boundary mapping, contract mapping, validation
and explicit governance for HTTP, CLI, modules/packages, events, database/state,
file formats, auth/session and process boundaries.

The optional `maturity` object in each sibling contract manifest records the exact
named `level`, a bounded `scope`, and a `limitations` array. The machine-readable
vocabulary is declared in
[`contract-manifest.schema.json`](../../schemas/contract-manifest.schema.json)
and reused by generated contract checks. Do not maintain a competing level in
the Markdown contract. See the canonical model for a JSON example and synthetic
boundary inventories.

Expanded output includes contract starters at C0 Inventory, explicitly limited
to scaffold subjects with consumer applicability unassessed. Focused output
keeps its existing smaller surface without contract artifacts. Client-specific
contracts retain their existing gates. Existing manifests without maturity
remain valid and unassessed; neither legacy documents nor user-edited generated
projects are automatically promoted or migrated. Use the existing reviewed
generation flow when choosing to refresh a project.

`node scripts/check-contract-manifests.mjs` in generated expanded output checks
metadata, required files and bounded local evidence. Evidence records identify
exact files in the harness or configured consumers, SHA-256 fingerprints, the
sibling documentation hash, check/observation, reported result and limitations.
Missing or stale C4 evidence produces actionable advisories without blocking
honest lower-maturity inventory.

C5 explicitly opts into blocking policy: declare exact governed files and a
reviewed content baseline for their source, documentation and evidence hashes.
Changed governed files require matching current evidence and documentation
updates. A documentation source-fingerprint marker binds each successive refresh
to the current evidence sources so an earlier update cannot cover a later change.
Missing sources, incomplete or scope-mismatched baselines, and stale
evidence fail C5. Unchanged files need no artificial updates. The canonical
contract guide explains checkpoint creation, hashing and refresh. This local
policy uses no runner, network checks or automatically executed manifest commands.
Existing generated projects use the existing reviewed regeneration flow; they
are not silently rewritten.

Hash checks prove bounded byte freshness and update presence. They cannot prove
prose correctness, check execution, semantic coverage, runtime behavior or the
historical authenticity of a baseline. Scope/checkpoint changes and maturity
reductions need explicit review. See the canonical guide for these limits.
Contract maturity is separate from the four readiness dimensions: structural
validity, verified knowledge, installation/adoption and observed effectiveness.
