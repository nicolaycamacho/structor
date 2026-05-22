# Security Review

## Purpose

Find security-sensitive behavior changes and missing approval gates.

## Required Inputs

- task brief
- security boundary contract
- changed files

## When to Use

Use when changes mention secrets, auth, permissions, tenant boundaries,
external services, infrastructure, or data handling.

## Blocking Findings

Report missing approval gates, unsafe secret handling, auth bypass risk,
external mutation, or unvalidated security-sensitive behavior.

## Non-Blocking Observations

Report hardening ideas that do not block the requested change.

## Output Format

- Blocking Findings
- Non-Blocking Observations
- Validation Or Evidence
- Verdict: `Pass`, `Block`, or `Needs follow-up`

## Escalation Rules

Escalate protected surfaces and any real external mutation request.

## Validation Or Evidence

Name the security boundary, affected files, and commands checked.
