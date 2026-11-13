# Contracts

Contracts describe cross-boundary interfaces, resources and invariants, within
one repo or across repos. They do not implement behavior.

## Index

- `repo-boundaries.md`: repository ownership boundaries
- `app-legibility.md`: commands, health checks, and validation evidence expected
  from consumer repos
- `api-boundary.md`: API ownership and compatibility expectations
- `security-boundary.md`: protected surfaces and human approval gates
- `codex-hooks.md`: local hook behavior and safety limits
- `release-flow.md`: release and external mutation safety
- `github-safety.md`: remote repository mutation guardrails

Contract JSON manifests use the `*.contract.json` suffix and are checked by
`node scripts/check-contract-manifests.mjs`.

## Maturity Model

This is the canonical definition of contract maturity in the generated harness.
Use the exact named levels below. Each level adds to the preceding level within
the declared scope; it is a claim about that scope, not a score for the project.

| Level | What the claim means | Agent behavior before changing the boundary |
| --- | --- | --- |
| C0 Inventory | The interface, resource or starter policy subject is inventoried; consumer applicability may still be unknown. | Inspect source and identify participants. Keep unknowns explicit; do not infer a complete contract from its name. |
| C1 Flow Mapped | Participating systems or modules and their flow are identified. | Trace providers, consumers and ownership; do not infer protocol or data guarantees. |
| C2 Boundary Mapped | Consumer, provider, protocol, inputs and outputs are identified. | Inspect schemas, errors, auth/session assumptions and state before relying on behavior. |
| C3 Contract Mapped | Schemas, errors, auth assumptions, persistence, invariants and behavioral expectations are documented, including explicit non-applicability. | Compare the affected source with the map; documentation alone does not prove conformance. |
| C4 Validated | Local static or scripted checks compare the mapped contract to bounded source evidence. | Inspect the source scope, check, result and limitations; rerun the relevant check. A command name or green manifest check alone is insufficient. |
| C5 Governed | The validated boundary explicitly opts into a policy requiring matching contract documentation and evidence updates before review/merge. | Inspect the declared governed surfaces, change baseline and local enforcement; require matching updates for changes within that scope. Never infer enforcement from this label alone. |

## Metadata And Compatibility

The sibling JSON manifest owns the maturity claim. Do not repeat a separate
level in prose. The optional `maturity` object contains an exact `level`, a
non-empty bounded `scope`, and a `limitations` array of non-empty strings
(`[]` explicitly records none). For example, an honest synthetic inventory:

```json
{
  "maturity": {
    "level": "C0 Inventory",
    "scope": "HTTP: GET /widgets, existence only",
    "limitations": ["Participants, schema, auth and errors have not been mapped"]
  }
}
```

This block is a field to add to a normal contract manifest, not a complete
manifest. Existing manifests without maturity remain valid: missing maturity
means unassessed, not C0 and not validated. Preserve them until an explicit
review assigns a scoped claim. Generated starters inventory policy subjects at
C0; generation does not discover or verify consumer behavior. Review their
applicability before treating starter prose as a project contract. Regeneration
does not silently migrate or promote existing generated projects.

## Representative Boundaries

Use the same metadata shape for all of these synthetic C0 inventory examples.
Use the example subject as `maturity.scope`, keep `level` at `C0 Inventory`, and
record the missing map in `limitations`. No boundary-specific schema or runtime
probe is required just to inventory a contract.

| Boundary type | Example subject | Unknowns to record before mapping |
| --- | --- | --- |
| HTTP | GET /widgets | Provider, clients, request/response schemas, errors and auth |
| CLI | widget inspect | Caller, owning command, arguments, exit codes and output |
| Modules/packages | widget-store.read | Export owner, callers, types, errors and compatibility |
| Events | widget.updated | Producer, subscribers, payload, ordering and delivery |
| Database/state | widgets table | Readers, writers, schema, transactions and invariants |
| File formats | widget-export.json | Writer, reader, format version and migration rules |
| Auth/session | session cookie | Issuer, consumers, expiry, permissions and trust assumptions |
| Process boundaries | worker stdin/stdout | Parent, worker, protocol, lifecycle and failure behavior |

## Review And Validation Limits

Read the manifest and affected source together. At missing or low maturity,
report the uncertainty and map the portion needed for the change; honest
incomplete inventory is useful and its low level alone is not a blocking defect.
Keep explicit approval rules and independently established invariants in force.
If implementation and an established contract disagree, update one deliberately
after review. If a strong claim is unsupported or stale, report the evidence gap
and narrow or lower the claim rather than inventing certainty.

The manifest checker validates metadata shape and required-file existence only.
It does not verify source conformance, execute commands from the `validation`
array, or enforce C5 change policy. Evidence validation and opt-in C5 enforcement
are follow-up work; do not claim they exist because the label parses. Before
assigning C4 or C5, document bounded source evidence, the observation/check and
its limitations in the sibling contract, and verify any claimed local check or
enforcement actually exists. There is no automatic promotion or certification.

Contract maturity is separate from structural validity, verified knowledge,
installation/adoption and observed effectiveness in `ai/READINESS.md`. No level
proves those readiness dimensions, runtime correctness or improved agent outcomes.
