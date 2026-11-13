# Contract Drift Review

## Purpose

Find mismatches between contracts and implementation.

## Required Inputs

- relevant contract docs
- sibling manifest maturity, scope and limitations (missing means unassessed)
- changed files
- declared evidence sources, observation/check, result and limitations
- for C5, governed surfaces and the reviewed change baseline
- validation output

## When to Use

Use when code, docs, generated files, or validation may disagree with canonical
contracts.

## Blocking Findings

Report missing contract updates, stale generated artifacts, contradictory path
contracts, and unvalidated contract changes.

## Non-Blocking Observations

Report wording or discoverability improvements only after blocking findings.
Missing or low maturity alone is not blocking. Use the canonical model and
per-level behavior in `ai/contracts/README.md`; inspect the source needed for
the change, record unknowns and avoid inferring guarantees from incomplete maps.
For unsupported or stale stronger claims, report the evidence gap and narrow or
lower the claim. Run the local manifest check: lower levels report evidence gaps as advisories;
explicit C5 blocks missing/stale evidence or changed governed surfaces without
matching documentation/evidence updates. Review the declared surface set and
checkpoint changes, including lowered claims. Compare source and prose yourself;
a passing byte-freshness check does not establish semantic correctness, runtime
behavior, adoption or agent effectiveness. Never bypass C5 by resetting a
checkpoint to hide the current change.

## Output Format

- Blocking Findings
- Non-Blocking Observations
- Validation Or Evidence
- Verdict: `Pass`, `Block`, or `Needs follow-up`

## Escalation Rules

Escalate shared contract changes that affect consumer repos or protected
surfaces.

## Validation Or Evidence

Name the contract source, generated artifacts, and validation commands checked.
