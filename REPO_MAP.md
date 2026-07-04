# Structor Repository Map

## Purpose

This map explains how the Structor source repository is wired together. It is for contributors and AI agents changing Structor itself.

Structor source-repo wiring is different from generated consumer-harness output. The generated harness policy layer lives in `template/ai/*` and renders into generated projects. The public user guide corpus lives under `docs/*` and is indexed by `docs/manifest.json`. This file maps the Structor source repository and its maintenance surfaces.

The machine-readable companion is `.structor/manifest/repo-map.json`. Validate both with:

```sh
npm run check:repo-map
```

## How To Use This Map

Read this file before changing source-repo behavior. Use the agent routing guide to identify the smallest useful context set, then run the validation commands listed for the touched area.

Keep this file and `.structor/manifest/repo-map.json` synchronized when adding, removing, renaming, or reclassifying important source files, directories, package scripts, package-published paths, or synchronization groups.

## Package Identity

- Package name: `@structor-dev/cli`
- Version source: `package.json`
- CLI binary: `bin/structor.mjs`
- Package type: ESM (`"type": "module"`)
- Public package surface: controlled by `package.json.files`
- Canonical full validation: `npm run validate`

## Repository Topology

| Path | Responsibility | Source/generated | Published | Notes |
| --- | --- | --- | --- | --- |
| `bin/` | User-facing CLI entrypoint and command routing. | Source | Yes | Owns `structor init`, `generate`, `contribute structor`, and `doctor` routing. |
| `scripts/` | Generator implementation, validators, smoke checks, and helper libraries. | Source | Yes | Most deterministic behavior lives here. |
| `template/` | Canonical generated harness templates. | Source templates | Yes | `template/ai/*` owns generated policy. Keep model overlays and entrypoints thin. |
| `schemas/` | JSON schema contracts for harness configuration. | Source | Yes | Schema changes must match examples and validation. |
| `docs/` | Canonical user-facing Structor guide corpus. | Source docs | Yes | Indexed by `docs/manifest.json`; this repo map is intentionally separate. |
| `examples/` | Example generated-tree and configuration evidence. | Source examples | Yes | Checked by `scripts/check-examples.mjs`. |
| `contrib/` | Contributor/self-harness preset material and setup support. | Source preset | Yes | Generates or refreshes the sibling `structor-self` harness. |
| `test/` | Node test suite for CLI, rendering, setup, validation, and regressions. | Source tests | No | Run through `npm test` and `npm run validate`. |
| `.github/` | GitHub workflow and repository automation configuration. | Source config | No | Not part of the npm package. |
| `.structor/manifest/` | Structor source-repo machine-readable maintenance metadata. | Source metadata | No | `repo-map.json` supports this file. |

## CLI Entrypoints

| File | Responsibility | Reads | Writes |
| --- | --- | --- | --- |
| `bin/structor.mjs` | Public CLI router and setup wizard shell. | `package.json`, harness config, workspace files, generator modules. | Generated harness files, workspace entrypoints, consumer entrypoints, contributor workspace files after preview/consent. |
| `scripts/init-harness.mjs` | Deterministic initializer and template renderer. | `harness.config.json`, `template/**`, schema/helper modules. | Generated harness repository files and optional consumer entrypoints. |
| `scripts/setup-contributor.mjs` | Manual Structor contributor setup helper. | `contrib/self-harness/**`, source checkout state. | Sibling `structor-self` harness and optional source-repo pointer files. |

`bin/structor.mjs` should stay a CLI surface, not a service runtime. Deterministic generation belongs in `scripts/init-harness.mjs` and shared helpers.

## Init And Wizard Flow

`structor init` is the recommended local setup path for users creating a repository-local AI Harness Engineering Framework for consumer repos.

High-level flow:

1. Parse CLI options in `bin/structor.mjs`.
2. Gather workspace, project, model, and consumer repo facts through confirmation-oriented prompts.
3. Preview planned local writes before applying them.
4. Call the deterministic initializer in `scripts/init-harness.mjs`.
5. Optionally preserve existing root guidance and install thin consumer entrypoints.
6. Run completion gates so successful setup means generated governance validation and workspace checks completed.

The wizard must remain local-only. It must not run agents, call LLM APIs, mutate external services, open pull requests, or become an orchestrator.

## Generation Flow

Generation starts from harness configuration and templates:

1. `scripts/lib.mjs` resolves and validates config paths, workspace boundaries, consumer paths, and output safety.
2. `scripts/rendered-config.mjs` converts domain facts into safe Markdown, JSON, JavaScript, slug, and path render values.
3. `scripts/generated-harness-contract.mjs` declares generated artifacts, gates, trusted generated scripts, workspace checks, and validation plans.
4. `scripts/init-harness.mjs` renders enabled templates from `template/**` into the generated harness output.
5. Generated validation scripts verify the rendered harness shape.

Escaping, path normalization, and template placeholder behavior should stay centralized in the renderer and contract modules rather than leaking into individual templates.

## Template And Generated Harness Contract

`template/ai/*` is the canonical generated policy surface. Root `template/AGENTS.md.tpl`, `template/CLAUDE.md.tpl`, workspace entrypoints, and consumer entrypoints should stay thin and route agents back to the harness.

`scripts/generated-harness-contract.mjs` is the source of truth for which templates exist, which surfaces are gated by model/client support, and which generated files are required by governance or workspace checks.

When adding, removing, or renaming generated files, update the contract, templates, smoke coverage, and any examples that describe the generated tree.

## Validation Model

Primary source-repo commands:

| Command | Purpose |
| --- | --- |
| `npm run check:ci` | Fast structural checks for config, schemas, templates, contracts, examples, hygiene, docs, and repo-map drift. |
| `npm test` | Node test suite. |
| `npm run check:smoke` | Smoke-render generated harness variants and validate generated outputs. |
| `npm run check:contributor` | Smoke-test manual contributor and packaged contributor flows. |
| `npm run validate` | Canonical full local validation before release or PR. |

Generated harness validation is separate from Structor package validation. Generated harness checks are rendered into generated projects and protect generated governance, workspace routing, model overlay drift, hooks, compatibility, and readiness surfaces.

## npm Package Surface

`package.json.files` controls what is published to npm. The current published source surface includes:

- `bin/`
- `contrib/`
- `docs/`
- `examples/`
- `harness.config.example.json`
- `schemas/`
- `scripts/`
- `template/`
- `CHANGELOG.md`
- `ROADMAP.md`
- `README.md`
- `SECURITY.md`
- `LICENSE`

The package should include everything needed to run the CLI, generate harnesses, validate generated surfaces, read user docs, and run contributor setup. It should not include local generated output, private workspace state, or maintainer-only metadata unless intentionally added to `package.json.files`.

## Contributor And Self-Harness Flow

Structor contributors can use the manual setup path documented in `docs/reference/contributor-setup.md`:

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm run setup:contributor -- --dry-run
npm run setup:contributor
```

The source repo remains the repository contributors edit. The sibling `structor-self` harness is generated from `contrib/self-harness/**` and teaches agents how to work on Structor without changing generic generated-harness templates.

Do not put Structor-specific product content into active generic templates under `template/**`.

## Agent Routing Guide

| Change area | Read first | Validate |
| --- | --- | --- |
| CLI command routing or setup wizard behavior | `AGENTS.md`, `CONTEXT.md`, `bin/structor.mjs`, `scripts/init-harness.mjs`, `test/cli.test.mjs` | `npm run check:ci`, `npm test`, `npm run validate` |
| Deterministic generation | `scripts/init-harness.mjs`, `scripts/rendered-config.mjs`, `scripts/generated-harness-contract.mjs`, `template/**` | `npm run check:templates`, `npm run check:contracts`, `npm run check:smoke`, `npm run validate` |
| Template or generated policy content | `template/ai/HARNESS.md.tpl`, `template/ai/HUB.md.tpl`, relevant template file, `scripts/generated-harness-contract.mjs` | `npm run check:templates`, `npm run check:placeholders`, `npm run check:smoke` |
| Config schema or examples | `schemas/harness-config.schema.json`, `harness.config.example.json`, `examples/**`, `scripts/check-config.mjs`, `scripts/check-schemas.mjs` | `npm run check:config`, `npm run check:schemas`, `npm run check:examples` |
| User docs | `README.md`, `docs/index.md`, `docs/manifest.json`, touched docs pages | `npm run check:docs`, `npm run check:ci` |
| Validation scripts | Existing neighboring script, `scripts/lib.mjs`, relevant tests/smoke scripts | `npm run check:ci`, targeted script, `npm run validate` |
| Contributor setup | `docs/reference/contributor-setup.md`, `scripts/setup-contributor.mjs`, `scripts/smoke-contributor.mjs`, `contrib/self-harness/**` | `npm run check:contributor`, `npm run validate` |
| Package or release configuration | `package.json`, `README.md`, `docs/capabilities/validation.md`, `scripts/check-public-hygiene.mjs` | `npm run check:public-hygiene`, `npm run validate` |

## Synchronization Groups

### CLI and init behavior

- `bin/structor.mjs`
- `scripts/init-harness.mjs`
- `scripts/lib.mjs`
- `scripts/rendered-config.mjs`
- `test/cli.test.mjs`
- `docs/reference/commands.md`
- `docs/guides/setting-up-a-harness.md`
- `REPO_MAP.md`
- `.structor/manifest/repo-map.json`

### Generated harness output

- `template/`
- `scripts/generated-harness-contract.mjs`
- `scripts/init-harness.mjs`
- `scripts/rendered-config.mjs`
- `scripts/smoke-template.mjs`
- `examples/generated-harness-tree.md`
- `docs/reference/generated-files.md`
- `REPO_MAP.md`
- `.structor/manifest/repo-map.json`

### Validation surface

- `package.json`
- `scripts/check-*.mjs`
- `scripts/smoke-template.mjs`
- `scripts/smoke-contributor.mjs`
- `docs/capabilities/validation.md`
- `REPO_MAP.md`
- `.structor/manifest/repo-map.json`

### Contributor workflow

- `bin/structor.mjs`
- `scripts/setup-contributor.mjs`
- `scripts/smoke-contributor.mjs`
- `contrib/self-harness/`
- `docs/reference/contributor-setup.md`
- `REPO_MAP.md`
- `.structor/manifest/repo-map.json`

### Package and release behavior

- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `scripts/check-public-hygiene.mjs`
- `REPO_MAP.md`
- `.structor/manifest/repo-map.json`

## Drift Risks

- `package.json.scripts` can drift from contributor docs, validation docs, and repo-map metadata.
- `package.json.files` can omit files needed by packaged CLI or contributor setup.
- Template files can be added without updating `scripts/generated-harness-contract.mjs`.
- Generated contract entries can be updated without smoke coverage or generated tree examples.
- Root/model/consumer entrypoints can accidentally grow into duplicated policy instead of thin routing files.
- `docs/manifest.json` can be mistaken for maintainer wiring metadata; keep this repo map separate from user-guide retrieval metadata.
- Contributor self-harness content can accidentally leak Structor-specific guidance into generic templates.
