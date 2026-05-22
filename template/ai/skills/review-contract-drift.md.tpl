# Contract Drift Review

## Purpose

Find mismatches between contracts and implementation.

## Required Inputs

- relevant contract docs
- changed files
- validation output

## When to Use

Use when code, docs, generated files, or validation may disagree with canonical
contracts.

## Blocking Findings

Report missing contract updates, stale generated artifacts, contradictory path
contracts, and unvalidated contract changes.

## Non-Blocking Observations

Report wording or discoverability improvements only after blocking findings.

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
