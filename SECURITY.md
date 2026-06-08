# Security Policy

## Reporting A Vulnerability

Please do not disclose exploit details publicly before the issue has been
reviewed.

If GitHub private vulnerability reporting is available for this repository,
please use it first. Otherwise, open a minimal public issue that says you have a
security report to share, but leave exploit details, proof-of-concept payloads,
tokens, private paths, and affected private repositories out of the issue body.

This is a solo-maintainer project. Security reports are handled on a
best-effort basis, without a formal response-time or fix-time SLA.

## Scope

Structor is a local generator for repository-local AI Harness Engineering Frameworks. It
does not run agents, host services, collect telemetry, poll sessions, automate
pull requests, or mutate external services.

Security-sensitive areas include:

- Generated script templates and render gates.
- Path validation for consumer repositories and generated harness output.
- Generated agent entrypoints, hook guardrails, and validation scripts.
- Public release hygiene that prevents accidental private-project leakage.

## Supported Versions

Structor is experimental and early. Please report suspected vulnerabilities
against the current `main` branch unless a release-specific issue is clearly
involved.
