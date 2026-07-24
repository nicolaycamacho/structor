# Harness Engineering

Harness Engineering is the practice of making a repository legible and
reviewable for AI-assisted software work by giving agents a stable local policy
layer.

A single `AGENTS.md`, `CLAUDE.md`, or prompt file can tell an agent what to do,
but it cannot easily keep project facts, model-specific overlays, contracts,
task templates, review guidance, and validation policy synchronized across a
workspace.

Structor gives those files a stable generated shape:

- canonical shared guidance under `ai/*`
- thin model entrypoints for Codex and Claude Code
- contract manifests for important boundaries
- task templates for scoped work
- review guidance and quality tracking
- local validators that detect drift

The result is still plain files in your repository. Structor supplies the
shape and checks; your project still owns the truth.
