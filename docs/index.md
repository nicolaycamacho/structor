# Structor Docs

This directory is the canonical user-facing guide and tutor corpus for
Structor. It is for humans reading manually today, and it is intentionally
structured so future Structor skill, plugin, and MCP guide surfaces can route
questions to the right page without inventing a new documentation source.

Use these docs for questions about what Structor can do, how to get started,
how to troubleshoot setup, how to use generated harnesses well, and where
deeper references live.

Generated harness `ai/*` remains the policy layer inside generated projects.
It is not the Structor product guide corpus.

## Start Here

- [Quickstart](guides/quickstart.md)
- [Setting up a harness](guides/setting-up-a-harness.md)
- [Troubleshooting](guides/troubleshooting.md)
- [FAQ](faq.md)

## Concepts

- [What Structor is](concepts/what-structor-is.md)
- [Harness Engineering](concepts/harness-engineering.md)
- [Harness vs runner](concepts/harness-vs-runner.md)
- [Repo legibility](concepts/repo-legibility.md)

## Guides

- [Quickstart](guides/quickstart.md)
- [Setting up a harness](guides/setting-up-a-harness.md)
- [Populating a harness](guides/populating-a-harness.md)
- [Choosing agent clients](guides/choosing-agent-clients.md)
- [Reviewing generated files](guides/reviewing-generated-files.md)
- [Troubleshooting](guides/troubleshooting.md)

## Capabilities

- [Context routing](capabilities/context-routing.md)
- [Contracts](capabilities/contracts.md)
- [Validation](capabilities/validation.md)
- [Generated views](capabilities/generated-views.md)
- [Safe agent workflows](capabilities/safe-agent-workflows.md)

## Reference

- [Commands](reference/commands.md)
- [Configuration](reference/configuration.md)
- [Generated files](reference/generated-files.md)
- [Contributor setup](reference/contributor-setup.md)

## Anti-Patterns

- [Anti-pattern index](anti-patterns/index.md)
- [Using Structor as an orchestrator](anti-patterns/using-structor-as-orchestrator.md)
- [Duplicated policy](anti-patterns/duplicated-policy.md)
- [Magical agent claims](anti-patterns/magical-agent-claims.md)

## Machine-Readable Index

[manifest.json](manifest.json) lists the canonical guide pages and metadata for
future assistant-facing retrieval. Historical ADRs, issue specs, and launch
planning notes are intentionally excluded from that manifest.
