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
metadata shape and required-file existence. Accepting C4 or C5 syntax does not
verify its evidence or install enforcement. Evidence validation and opt-in C5
change enforcement belong to the follow-up
[#101](https://github.com/nicolaycamacho/structor/issues/101).
Contract maturity is separate from the four readiness dimensions: structural
validity, verified knowledge, installation/adoption and observed effectiveness.
