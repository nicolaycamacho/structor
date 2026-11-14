# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-11-14

### Changed

- Finish the agent-first installation transition: deprecate every published npm
  version, keep source package metadata private, and remove the interactive init
  wizard. New users install from a verified release through the README prompt.
- Replace npm tarball/install smoke with annotated pinned-checkout release and
  CLI smoke; keep public source hygiene coverage independent of npm metadata.
- Retain deterministic generation, agent plan/hash/apply, population, read-only
  Doctor, and contributor commands, including both setup profiles and regeneration.

## [0.3.1] - 2026-11-14

### Fixed

- Preserve annotated tag objects during CI checkout and verify the selected tag's
  commit against the triggering event before running the full validation matrix.
- Keep agent apply stdout as a single execution-result JSON object, with renderer
  progress on stderr, for reliable conversational and manual CLI integrations.

Version 0.3.0 failed its tag CI and fresh-install JSON check. Use 0.3.1 or newer;
its existing tag remains unchanged as a historical record.

## [0.3.0] - 2026-11-14

### Added

- Agent-native approved plan/hash/apply setup, deterministic evidence, and
  separate execution/readiness reports. Both focused and expanded profiles
  support fresh installation and regeneration with approved replacement backups.
- Focused harness generation, evidence-backed population, task ownership and
  repo-fit guidance, task guidance graph checks, and canonical target provenance.
- Full behavioral CI on the supported Node/npm matrix, isolated fixture Git
  environments, and contributor/setup regression coverage.
- Annotated Git release distribution, version/lockfile/changelog integrity checks,
  and strict tag provenance validation in tag CI and the installation protocol.

### Changed

- README now routes detail to `docs/` and recommends the agent installation
  prompt, which selects a validated release tag and records its source commit.
- Generated context routing, issue contracts, quality rules, and validation
  surfaces reflect the framework improvements merged since 0.2.0.

### Release history

- This is the first release under the annotated main-tag policy. The prior
  0.2.3–0.2.5 tags and npm versions predate that policy and are left untouched.
  In particular, the legacy 0.2.5 tag was outside main; it is not a qualifying
  release. This entry consolidates the intervening work previously missing
  from this changelog rather than claiming those versions were coherent releases.

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
