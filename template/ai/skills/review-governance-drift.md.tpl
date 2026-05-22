# Governance Drift Review

## Purpose

Find duplicated policy, stale routing, missing validation, and runner boundary
drift.

## Required Inputs

- harness docs
- changed governance files
- validation output

## When to Use

Use for harness policy, routing, templates, generated views, and validation
script changes.

## Blocking Findings

Report stale routing, missing manifest entries, duplicated policy, invalid
templates, and runner behavior that moved into the harness.

## Non-Blocking Observations

Report clarity and organization improvements only after blocking findings.

## Output Format

- Blocking Findings
- Non-Blocking Observations
- Validation Or Evidence
- Verdict: `Pass`, `Block`, or `Needs follow-up`

## Escalation Rules

Escalate remote mutation, generated policy source changes, and broad validation
changes to human review.

## Validation Or Evidence

Name the docs, manifest entries, generated files, and commands checked.
