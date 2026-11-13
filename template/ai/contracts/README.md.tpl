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

## Bounded Evidence

The generated manifest checker checks current file fingerprints and recorded
observations. It never executes a manifest's `validation` entries or
`evidence.check`. A C4 claim needs `maturity.evidence`; missing, malformed or stale
evidence produces actionable advisories, with a successful exit for levels below
C5. Existing core metadata shape and required-file checks still apply. No label
is automatically promoted or certified.

An evidence record has these fields:

- `sources`: a nonempty list of `{ "repo", "path", "sha256" }` snapshots.
  `repo` is the exact generated harness name or a configured consumer name.
  `path` is an exact slash-separated path relative to that repository, without
  traversal, `.git`, absolute paths or globs. Resolved files must remain inside
  that repository. Hash the raw file bytes with SHA-256 (64 lowercase hex digits).
- `documentationSha256`: the SHA-256 of the sibling Markdown contract's bytes.
- `check`: the bounded manual observation or local command used to compare the
  mapped contract to those sources. This is a recorded method, never an
  automatically executed command.
- `observation` and `result`: a nonempty description of what was observed, and
  the exact result `pass`. Failed or unobserved checks cannot support the claim.
- `limitations`: a nonempty array describing the observation's actual limits,
  separate from the broader `maturity.limitations`.

The check's scope must match `maturity.scope`. Include every file needed to
support that bounded claim, including local scripts or fixtures used by a
scripted check. The validator checks byte freshness, presence and record shape;
it cannot determine whether the selected files are sufficient, whether the
reported check ran or whether prose correctly describes source behavior. Review
those facts explicitly. Source changes or documentation changes make the
record stale until reviewed and refreshed. Freshness here means matching bytes,
not a time-based expiry or a claim about an external system.

## Explicit C5 Policy

Only the exact `C5 Governed` level opts into blocking enforcement. Add
`maturity.governance` with:

- `surfaces`: a nonempty list of `{ "repo", "path" }` exact governed files.
- `baseline`: a reviewed content checkpoint containing `sources` snapshots for
  exactly that surface set, the sibling `documentationSha256`, and
  `evidenceSha256` for the evidence record at the checkpoint.

Missing or incomplete baselines, mismatched surface sets, missing source files,
and unsupported evidence fail C5. Unchanged surfaces pass with current evidence;
they do not require artificial documentation updates. When any governed surface
differs from its baseline hash, current evidence must cover every governed file,
the sibling documentation must differ from its checkpoint hash, and the evidence
record must differ from its checkpoint hash. The sibling documentation must
also contain exactly one current source fingerprint on its own line:

```text
<!-- structor:contract-sources-sha256 SHA256_OF_CANONICAL_EVIDENCE_SOURCES -->
```

Replace the uppercase label with the SHA-256 of the canonical JSON for the
current `evidence.sources` array, using the same algorithm below. This binds the
documentation to each successive source refresh: a previous documentation update
cannot satisfy a later source change merely because it differs from an old
checkpoint. Update the prose after review and refresh the marker before hashing
the documentation for evidence. The marker proves an update, not prose accuracy.

Updating only documentation or only evidence cannot satisfy this policy. Extra evidence sources remain allowed and
are also checked for freshness.

This is a file-content checkpoint, not a Git revision, timestamp or automatic
merge-base. A checkpoint does not expire just because it is old: its source set
must still match the declared scope, and all current evidence must match bytes.
An obsolete scope requires deliberate baseline review. Keep the checkpoint while
refreshing a change; replacing it with current hashes to hide a change defeats
the policy. Review baseline/scope edits and level reductions explicitly. The
checker cannot authenticate checkpoint history or detect undeclared files,
semantic no-op documentation edits, falsified observations or changes reverted
to identical bytes. File additions/deletions require an explicit scope/checkpoint
review; directories and glob-based discovery are outside this bounded policy.

### Record And Refresh A Checkpoint

1. Map the boundary and run the declared local check or manual observation.
2. Record source hashes, observation, result and limitations in
   `maturity.evidence`. Select the exact governed files. Compute and insert the
   source fingerprint marker, then record the sibling documentation hash.
3. For the initial reviewed checkpoint, copy snapshots for those files into
   `governance.baseline.sources` and record the documentation hash. Compute the
   evidence hash after its documentation hash is final, then record it too.
4. On a governed change, rerun the relevant check, update the sibling contract,
   refresh the source fingerprint marker, and refresh evidence for the new bytes.
   Keep the checkpoint for comparison.
5. Run `node scripts/check-contract-manifests.mjs`, then
   `node scripts/validate-governance.mjs`. Review any advisories as evidence gaps.

For `evidenceSha256`, hash UTF-8 JSON with recursively sorted object keys, array
order preserved and no whitespace. This local snippet prints the evidence hash
and documentation marker for a reviewed manifest; it does not modify the
manifest or run its check:

```js
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile(process.argv[2], "utf8"));
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");
console.log("Evidence checkpoint hash:", hash(manifest.maturity.evidence));
console.log(`<!-- structor:contract-sources-sha256 ${hash(manifest.maturity.evidence.sources)} -->`);
```

Save it as a local `.mjs` helper and pass the manifest path as its first argument.
Use the same SHA-256 algorithm over raw file bytes for source/document hashes.
Neither generating hashes nor passing local validation proves that prose is
correct, the recorded check ran, runtime behavior conforms, or agents are effective.

Contract maturity is separate from structural validity, verified knowledge,
installation/adoption and observed effectiveness in `ai/READINESS.md`. No level
proves those readiness dimensions, runtime correctness or improved agent outcomes.
