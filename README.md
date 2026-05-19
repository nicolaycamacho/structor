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

## Agent-Assisted Bootstrap

The preferred setup path is to use a bootstrap prompt in Codex or Claude Code.
This lets the agent inspect the sibling consumer repos, generate a project
config, preview writes, create the harness, install pointer files, and validate
the result with evidence.

### Preconditions

- Node.js 20 or newer is available.
- This template repo is cloned locally.
- The generated harness repo and consumer repos will live as siblings under one
  workspace folder.
- Consumer repos are already cloned, or their intended sibling folder names are
  known.
- Existing consumer `AGENTS.md`, `CLAUDE.md`, and `.claude/*` files should be
  reviewed before using `--force`.

Recommended workspace shape:

```text
workspace/
  ai-engineering-harness-template/
  project-engineering-harness/     # generated output
  project-frontend/                # consumer repo
  project-backend/                 # optional consumer repo
```

### Bootstrap Prompt

Paste this into Codex or Claude Code from the root of this template repo:

```text
Use this repo to create a project-specific AI engineering harness.

Project facts:
- Project name: <fill in>
- Harness repo folder name: <fill in, for example project-engineering-harness>
- Consumer repos: <fill in sibling repo folder names and purposes>
- Models to support: OpenAI/Codex and Anthropic/Claude Code unless I say otherwise

Rules:
- Read AGENTS.md, README.md, harness.config.example.json, template/ai/AGENTS.md.tpl,
  template/ai/HUB.md.tpl, and scripts/init-harness.mjs before editing.
- Keep the template generic; do not add product-specific content to active
  templates.
- Create or update harness.config.json for this workspace.
- Run npm run validate before generating anything.
- Run npm run init -- --config harness.config.json --dry-run and summarize the
  planned writes before writing files.
- If the dry run is correct, run npm run init -- --config harness.config.json
  --install-consumer-entrypoints.
- Do not overwrite existing consumer AGENTS.md, CLAUDE.md, or .claude/* files
  unless I explicitly approve --force.
- In the generated harness, run node scripts/validate-governance.mjs.
- Run node scripts/bootstrap-workspace.mjs --dry-run from the generated harness
  and then run node scripts/bootstrap-workspace.mjs only if the preview is safe.
- Report commands run, files changed, generated temp or output paths, skipped
  files, failures, and remaining manual follow-ups.
```

The generated harness includes starter product, architecture, design, contract,
review, quality, decision, and workspace-bootstrap files. The agent should fill
obvious project-specific facts from `harness.config.json` and consumer repo
inspection, then leave explicit starter sections for facts that require human
input.

## Manual Commands

Use these when you want to operate the template without an agent-assisted
bootstrap prompt.

```sh
cp harness.config.example.json harness.config.json
```

Edit `harness.config.json`, then validate the template:

```sh
npm run validate
```

Preview generation:

```sh
npm run init -- --config harness.config.json --dry-run
```

Generate the harness:

```sh
npm run init -- --config harness.config.json
```

Install missing consumer repo pointer files too:

```sh
npm run init -- --config harness.config.json --install-consumer-entrypoints
```

The initializer skips existing consumer `AGENTS.md`, `CLAUDE.md`, and
`.claude/CLAUDE.md` files unless `--force` is passed.

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
