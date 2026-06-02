# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-03

### Added

- `structor doctor` diagnostics for generated workspaces and consumer pointers.
- Structor contributor bootstrap support, including the self-harness preset,
  setup command, and contributor smoke checks.
- Passive generation manifests for generated harnesses.
- Public onboarding, contributor setup, example, and launch-positioning docs.

### Changed

- `structor init` now defaults the generate-harness confirmation to yes after
  previewing the planned writes.
- Generated harness templates now include stronger governance, workspace,
  validation, and cockpit surfaces.

### Fixed

- Hardened generated writes, consumer entrypoints, symlink handling, generated
  JavaScript/Markdown escaping, shell-quoted worktree repair commands, and
  validator provenance checks.
- Centralized config resolution, rendered template values, generated harness
  contracts, and generated-path safety checks.

## [0.1.0] - 2026-05-29

Initial experimental release of the `@structor-dev/cli` harness generator.

### Added

- `structor init` guided, local-only, deterministic workspace setup with sibling
  consumer-repo detection, config preview, and dry-run before any writes.
- `structor generate` to render a harness from an existing `harness.config.json`,
  with `--dry-run`, `--force`, `--install-consumer-entrypoints`, and safe
  output-path enforcement.
- Versioned harness template covering context routing (`ai/HUB.md`), contracts,
  task templates, review skills, quality tracking, and decisions.
- Codex and Claude Code client surfaces gated by `models` and `clientSupport`
  config, including Codex hook scaffolding and Claude project rules.
- Mechanical validators: config-shape, template-file, task-template,
  contract-manifest, model-overlay, and placeholder-leak checks, plus a smoke
  test that generates and bootstraps disposable workspaces.

### Notes

- `structor doctor` is planned but not yet implemented.
- Claude hooks and Claude skills are deferred; keep those flags off until
  fixture-backed validators exist.
