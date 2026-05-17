# AI Engineering Harness Template

This repository is a generic template for creating project-specific AI
engineering harness repositories.

The template is structurally inspired by `wari1986/ai-engineering-harness`, but
the active template is project-neutral. It must not carry source-project or
other consumer-specific policy in generated harness docs.

## Core Model

- Harness: policy, contracts, context routing, task shape, validation, review
  rules, and quality tracking.
- Runner: execution runtime, polling, agent sessions, PR automation, dashboards,
  repair loops, and external writes.
- Consumer repos: product or application implementation repositories.
- Model overlay: a thin compatibility layer for one model or agent system.

Canonical policy belongs in shared `ai/*` docs. Model-specific files and
consumer repo entrypoints route into those docs instead of duplicating policy.

## Quick Start

1. Copy `harness.config.example.json` to `harness.config.json`.
2. Edit the project name, output path, and consumer repository list.
3. Run `npm run validate`.
4. Run `npm run init -- --config harness.config.json`.

To preview without writing files:

```sh
npm run init -- --config harness.config.json --dry-run
```

To install missing consumer repo pointer files too:

```sh
npm run init -- --config harness.config.json --install-consumer-entrypoints
```

The initializer never overwrites existing consumer `AGENTS.md` or `CLAUDE.md`
files unless `--force` is passed.

## Consumer Repo Entrypoints

Each configured consumer repo should have short root-level pointer files:

- `AGENTS.md` for OpenAI/Codex-compatible agents
- `CLAUDE.md` for Anthropic/Claude-compatible agents

These files should point to the generated harness and may include only minimal
repo-local facts such as repository purpose and validation commands. They
should not copy canonical harness policy.

If you do not want the script to write into consumer repos, create the files
manually using:

- `template/consumer/AGENTS.md.tpl`
- `template/consumer/CLAUDE.md.tpl`

## Validation

Run:

```sh
npm run validate
```

This checks config examples, required template files, task template structure,
contract manifest schema, placeholder hygiene, and model overlay thinness.

For a real project config, require configured consumer repo paths to exist:

```sh
node scripts/check-config.mjs --config harness.config.json --require-existing-consumers
```

## Non-Goals

- No runner or orchestration runtime.
- No Linear, GitHub, Codex, Claude, or CI automation.
- No dashboards, polling loops, session control, auto-merge, or repair daemons.
- No consumer implementation logic.
- No source-project or other project-specific content in active templates.
