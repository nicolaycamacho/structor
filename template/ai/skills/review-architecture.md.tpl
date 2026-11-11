# Architecture Review

## Purpose

Find boundary, ownership, and change-amplification risks.

## Required Inputs

- task brief
- relevant contract docs
- changed files
- Repository Fit evidence, including local analogues, callers, preserved
  conventions and proposed departures (or focused local inspection for tiny tasks)

## When to Use

Use when changes affect ownership, routing, repo boundaries, data flow, or
shared abstractions.
Review architecture-sensitive convention departures before implementation;
require reasons and preserved contracts, and resolve blocking findings before
coding. Missing or conflicting local precedent is uncertainty to review, not
permission to invent a convention.

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
