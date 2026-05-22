# Architecture Review

## Purpose

Find boundary, ownership, and change-amplification risks.

## Required Inputs

- task brief
- relevant contract docs
- changed files

## When to Use

Use when changes affect ownership, routing, repo boundaries, data flow, or
shared abstractions.

## Blocking Findings

Report behavior regressions, boundary violations, missing validation, and
changes that make future work harder to reason about.

## Non-Blocking Observations

Report style, naming, or organization improvements only after blocking findings.

## Output Format

- Blocking Findings
- Non-Blocking Observations
- Validation Or Evidence
- Verdict: `Pass`, `Block`, or `Needs follow-up`

## Escalation Rules

Escalate protected surfaces, cross-repo contracts, and remote mutations to
human review.

## Validation Or Evidence

Name the exact files, commands, and evidence used for the review.
