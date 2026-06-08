# Structor

> Experimental. Early infrastructure for harness engineering. The API,
> generated layout, and config shape may change.

Structor is a local harness-engineering toolkit. It generates a
repository-local AI Harness Engineering Framework: a versioned policy layer for Codex,
Claude Code, and similar agents to share context routing, contracts, task shape,
review expectations, and validation guidance.

Structor is a generator, not a runtime. It creates plain local files and
validators; it does not run agents, coordinate sessions, open pull requests,
host services, call LLM APIs, install packages, collect telemetry, or mutate
external systems.

## Provenance

Structor is independently developed as a generalized, organization-agnostic
harness-engineering toolkit. Public Structor templates, validators, examples,
and documentation should avoid proprietary implementation details,
organization-specific workflows, confidential architecture, secrets, and client-
or employer-specific artifacts.

## Quick Start

Run Structor from the workspace folder that contains your consumer repos:

```sh
npx @structor-dev/cli init
```

During local development from the parent workspace containing the `structor/`
clone, use:

```sh
node ./structor/bin/structor.mjs init
```

`structor init` is local-only and deterministic. It detects sibling repos, asks
a few confirmation-oriented questions, infers project identity, harness
directory, consumer repo names, and validation commands from local evidence,
previews the planned setup transaction, asks before writing, and reports setup
completion only after deterministic local gates pass.

## First-Minute Safety

- No network calls, LLM calls, telemetry, package installs, or remote service
  mutation during `init` or `generate`.
- Existing root agent guidance is not silently deleted, uploaded, interpreted,
  or automatically merged.
- The planned guidance takeover flow asks for consent before replacing existing
  root `AGENTS.md` or `CLAUDE.md` entrypoints.
- Preserved guidance remains consumer-local source material for a later reviewed
  migration.
- Setup completion and guidance readiness are separate states: Structor can
  finish deterministic setup while still requiring project-specific guidance
  migration.

## Generated Output

Running `init` creates a generated harness repo as a sibling of your code:

```text
workspace/
  my-app-structor/        # generated harness: policy, contracts, validation
  my-app-frontend/        # your code
  my-app-backend/         # optional second repo
```

Inside `my-app-structor/`:

```text
ai/                 canonical policy: context routing, contracts, task templates,
                    review skills, quality tracking, decisions
AGENTS.md           thin Codex entrypoint -> routes into ai/
CLAUDE.md           thin Claude Code entrypoint -> routes into ai/
scripts/            validation that mechanically enforces the rules above
```

Optional consumer repo pointer files can route agents back to the generated
harness from each code repo.

## Learn More

- [Init and setup manual](docs/INIT.md)
- [Guidance safety and post-init migration](docs/GUIDANCE-SAFETY.md)
- [Contributor setup](docs/CONTRIBUTOR-SETUP.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)

## Why Not Just Use A Rules File?

A single `AGENTS.md`, `CLAUDE.md`, or prompt file can tell an agent what to do,
but it cannot easily keep project facts, model-specific overlays, contracts,
task templates, review guidance, and validation policy synchronized across a
workspace.

Structor keeps canonical policy in the generated harness, keeps consumer
entrypoints thin, and ships validators that check the structure. The result is
still plain files in your repository; Structor just gives those files a stable
shape and a way to detect drift.

The generated harness starts with structured starter guidance. Structor does not
infer complete project conventions, architecture, contracts, or validation
expectations from consumer repo code during deterministic setup. Those
repo-specific details belong in the post-init guidance migration and review
step.

## Why It Exists

Most AI coding workflow tooling is a pile of prompts and rules with nothing
enforcing them. Structor's bet is that reliable agentic engineering needs
context architecture plus mechanical enforcement. The generated harness ships
with validators that fail when policy drifts: overlay drift checks, contract
manifest checks, task-shape checks, and hook guardrails.

## Conservative Manual Path

If you prefer the conservative manual path, create `harness.config.json` and
run:

```sh
npx @structor-dev/cli generate --config harness.config.json --dry-run
npx @structor-dev/cli generate --config harness.config.json --install-consumer-entrypoints
```

See `docs/INIT.md` for the exact safety model, read/write behavior, and
recovery expectations.

## How Structor Differs From A Runner

Structor creates files and validation scripts. A runner executes or coordinates
agent work over time.

Structor does not start agent sessions, poll threads, assign tasks, open pull
requests, shepherd CI, auto-repair code, merge branches, or host dashboards.
Those behaviors belong in a separate runner or orchestration layer. Generated
Codex hooks are local policy guardrails only; they are not a general execution
runtime or a complete security boundary.

## Codex And Claude Support

Structor uses a hybrid model for client support:

- Concrete template files provide the stable structure, safety defaults, and
  validators.
- The initialization agent may customize project-specific wording, deny-rule
  descriptions, and review guidance after inspecting the consumer repos.
- The initialization agent should not invent the client-support structure from
  scratch.

This keeps generated harnesses consistent while still allowing each project to
adapt the guidance to its own domain.

Generated Codex support can include:

- `AGENTS.md`
- `ai/model-overlays/openai/AGENTS.md`
- `.codex/hooks.json`
- `scripts/hooks/codex-hook.mjs`
- `scripts/hooks/lib/codex-hooks-core.mjs`
- `scripts/check-codex-hooks.mjs`

Generated Claude Code support can include:

- `CLAUDE.md`
- `ai/model-overlays/anthropic/CLAUDE.md`
- `scripts/check-claude-compatibility.mjs`

Default behavior:

- `models.openai: true` generates Codex entrypoints and Codex hook scaffolding.
- `models.anthropic: true` generates Claude entrypoints through `CLAUDE.md`.
- Claude `.claude/*` project memory, settings, and rules are deferred for a
  future opt-in surface.
- Claude hooks and Claude skills are reserved for future support. Keep those
  flags false or omit them.

Optional config:

```json
"clientSupport": {
  "codex": {
    "hooks": true
  },
  "claude": {
    "rules": false,
    "hooks": false,
    "skills": false
  }
}
```

Codex hooks generated by this template are intentionally conservative: they are
local, deterministic, bounded to short timeouts, and validated to avoid network
calls, external writes, and runtime-state mutation. They are harness policy
guardrails, not a runner or a complete security boundary. They catch common
high-risk operations and provide contextual reminders, but they do not replace
sandboxing, permission controls, code review, CI policy, or secret management.

## Deferred Or Missing Surfaces

These boundaries are intentional in the current template:

- Claude hooks are deferred. Keep `clientSupport.claude.hooks` false or omit it
  until hook templates and fixture-backed validators are added.
- Claude skills are deferred. Keep `clientSupport.claude.skills` false or omit
  it until committed `.claude/skills/*/SKILL.md` templates and validation are
  added.
- Read-only generated Harness Cockpit views under `ai/views/*` are allowed
  when they are derived from canonical local files and do not execute workflows.
- The initializer creates a repo-shaped harness folder, but it does not run
  `git init`, create remotes, install dependencies, publish branches, or modify
  external services.
- Consumer repo entrypoints are installed during
  `structor generate --config harness.config.json --install-consumer-entrypoints`.
  The generated workspace
  bootstrap script installs workspace-level pointers and verifies consumer
  routing; it does not repair missing consumer pointers after initialization.
- Runner behavior remains out of scope. Polling, PR automation, live
  dashboards, auto-merge, repair loops, and CI shepherding belong in a separate
  runner or orchestration layer.

## Out-of-the-Box Flow

The supported happy path is:

1. Clone this template repo into the same workspace folder as the consumer repos.
2. Run `structor init` from the workspace folder.
3. Let Structor generate the project harness as a sibling of the consumer repos.
4. Let Structor install or verify consumer and workspace entrypoints before success.
5. Start Codex or Claude Code from the workspace, generated harness, or a
   bootstrapped consumer repo.

The sibling layout matters. The generated harness scripts assume the harness
repo and consumer repos share one parent workspace folder.

```text
workspace/
  structor/                         # this repo
  project-structor/                 # generated harness output
  project-frontend/                 # consumer repo
  project-backend/                  # optional consumer repo
```

With that layout, the current flow can bootstrap consumer repos out of the box
when their agent pointer files are missing. For safety, existing consumer root
`AGENTS.md` and `CLAUDE.md` files are preserved consumer-locally before Structor
replaces them with thin root entrypoints, or `init` aborts before writing.
Existing `.claude/*` files are not part of the default init takeover surface.
If you generate the harness somewhere else, move or copy it into the sibling
workspace layout before running the generated workspace bootstrap scripts.

## Agent-Assisted Manual Setup

When you want an agent to drive the conservative manual path, run the
initialization prompt in Codex or Claude Code from the root of this template
repo. The agent should inspect the sibling consumer repos, create
`harness.config.json`, preview writes, generate the harness, install consumer
pointers, and validate the result with evidence.

### Preconditions

- Node.js 20 or newer is available.
- This template repo is cloned locally.
- Consumer repos are already cloned as siblings, or their intended sibling
  folder names are known.
- The generated harness output path will be a sibling of the consumer repos.
- Existing consumer root `AGENTS.md` and `CLAUDE.md` files are handled through
  the preserve-or-abort flow, not `--force`.
- Existing managed pointer surfaces such as `.claude/*` have been reviewed
  before using `--force`.

### Initialization Prompt

Paste this into Codex or Claude Code from the root of this template repo:

```text
Use this repo to create a project-specific AI Harness Engineering Framework.

Project facts:
- Project name: <fill in>
- Harness repo folder name: <fill in, for example project-structor>
- Consumer repos: <fill in sibling repo folder names and purposes>
- Models to support: OpenAI/Codex and Anthropic/Claude Code unless I say otherwise
- Client support: generate Codex hooks unless I say otherwise; keep Claude
  rules, hooks, and skills disabled until Structor adds explicit opt-in support

Rules:
- Read AGENTS.md, README.md, harness.config.example.json, template/ai/AGENTS.md.tpl,
  template/ai/HUB.md.tpl, template/README.md.tpl, scripts/init-harness.mjs,
  template/scripts/bootstrap-workspace.mjs.tpl, and
  template/scripts/check-workspace.mjs.tpl before editing.
- Keep the template generic; do not add product-specific content to active
  templates.
- Create or update harness.config.json for this workspace.
- Set output.path so the generated harness repo is a sibling of the consumer repos.
- Set consumer paths as workspace-relative sibling paths such as `./project-app`;
  do not use absolute paths or `..` traversal.
- Use concrete template-provided client-support files. Do not invent Codex or
  Claude Code surfaces from scratch.
- If customizing Codex hook rules, keep them deterministic, local, read-only,
  short-timeout, and fixture-validated.
- If customizing Claude Code support, keep `.claude/**` thin and routed to
  canonical `ai/*` docs. Do not add Claude hooks without a validator.
- Run npm run check:ci before generating anything; use npm run validate when you
  want the full local smoke suite.
- Run npm run generate -- --config harness.config.json --dry-run and summarize the
  planned writes before writing files.
- If the dry run is correct and no existing root guidance is present, run npm
  run generate -- --config harness.config.json --install-consumer-entrypoints.
- If existing consumer root AGENTS.md or CLAUDE.md files are present, choose
  preserve-and-replace or abort. Use --preserve-existing-guidance only with
  explicit approval.
- Do not use --force to take over existing consumer root AGENTS.md or CLAUDE.md.
- Do not overwrite existing managed pointer surfaces such as .claude/* unless I
  explicitly approve --force after review.
- In the generated harness, run node scripts/validate-governance.mjs.
- If Codex hooks are enabled, confirm node scripts/check-codex-hooks.mjs passed.
- If Claude support is enabled, confirm node scripts/check-claude-compatibility.mjs passed.
- Confirm node scripts/check-overlay-drift.mjs passed.
- From the generated harness, run node scripts/bootstrap-workspace.mjs --dry-run
  and summarize planned workspace pointer writes.
- If the workspace bootstrap preview is safe, run node scripts/bootstrap-workspace.mjs.
- From the generated harness, run node scripts/check-workspace.mjs.
- Report commands run, files changed, generated temp or output paths, skipped
  files, failures, and remaining manual follow-ups.
```

The generated harness includes starter product, architecture, design, contract,
review, quality, decision, task-template, and workspace-bootstrap files. The
agent should fill obvious project-specific facts from `harness.config.json` and
consumer repo inspection, then leave explicit starter sections for facts that
require human input.

## Manual Setup

Use these commands from this template repo when you want to operate the
template without an agent-assisted prompt.

Copy and edit the example config:

```sh
cp harness.config.example.json harness.config.json
```

Set:

- `project.name`, `project.slug`, and `project.harnessRepoName`
- `output.path` to a generated harness repo path that is a sibling of the
  consumer repos, for example `../project-structor`
- `models.openai` and `models.anthropic`
- optional `clientSupport.codex.hooks`
- keep `clientSupport.claude.rules`, `clientSupport.claude.hooks`, and
  `clientSupport.claude.skills` false or omitted until those surfaces are added
- each consumer `name`, workspace-relative sibling `path`, `purpose`, and
  validation commands. Consumer paths must stay inside the workspace and cannot
  use absolute paths or `..` traversal. From a template clone at
  `workspace/structor`, use paths like `./project-app`, not `../project-app`.

Validate the template and config shape:

```sh
npm run check:ci
node scripts/check-config.mjs --config harness.config.json --require-existing-consumers
```

Use `npm run validate` when you want the full local smoke suite, including
generated harness checks.

Preview generation:

```sh
npm run generate -- --config harness.config.json --dry-run
```

Generate the harness and install missing consumer entrypoints:

```sh
npm run generate -- --config harness.config.json --install-consumer-entrypoints
```

Then validate and bootstrap from the generated harness:

```sh
cd ../<harness-repo-folder>
node scripts/validate-governance.mjs
node scripts/bootstrap-workspace.mjs --dry-run
node scripts/bootstrap-workspace.mjs
node scripts/check-workspace.mjs
```

Use `--force` only after reviewing existing managed pointer surfaces such as
workspace entrypoints that would be overwritten. Do not use
`--force` as consent to take over existing consumer root `AGENTS.md` or
`CLAUDE.md`; use the preserve-or-abort guidance flow instead.

## Consumer Repo Entrypoints

Each configured consumer repo should have short pointer files:

- `AGENTS.md` for OpenAI/Codex-compatible agents
- `CLAUDE.md` for Anthropic/Claude-compatible agents

These files point to the generated harness and may include only minimal
repo-local facts such as repository purpose and validation commands. They
should not copy canonical harness policy.

After initialization, an agent starting inside a consumer repo should read the
local pointer file first, then follow the harness route through `ai/HUB.md`.
Consumer repos still own implementation, runtime behavior, local tests, and
deployment checks.

### Claude Code Skills Boundary

Claude Code discovers project skills from `.claude/skills/*/SKILL.md` in the
current repo, parent repos up to the repo root, and configured global or
additional directories. A consumer `CLAUDE.md` pointer to a sibling generated
harness does not make harness-local `.claude/skills` available when Claude Code
starts inside the consumer repo.

If consumer repo sessions need Claude Code skills, install or copy those skills
into each consumer repo under `.claude/skills`, install them globally under
`~/.claude/skills`, or start Claude Code with the harness added as an additional
directory. Do not put reusable Claude Code skills in `ai/skills`; that directory
is reserved for harness review guidance and is not a Claude Code skill discovery
path.

If you do not want the script to write into consumer repos, create the files
manually using:

- `template/consumer/AGENTS.md.tpl`
- `template/consumer/CLAUDE.md.tpl`

## Validation

Run:

```sh
npm run check:ci
npm run validate
```

Validation is split into fast structural checks and the full local smoke suite.

`npm run check:ci` covers the cheap checks that feed both local development and
CI: config examples, active shipped schemas, required template files, task
template structure, contract manifest schema, placeholder hygiene,
public-release hygiene, and model overlay thinness.

The active shipped schemas are `schemas/harness-config.schema.json` and
`schemas/contract-manifest.schema.json`. Task brief validation is intentionally
Markdown/template based through `scripts/check-task-template.mjs`, not a shipped
JSON Schema contract.

Generated harness files are declared in `scripts/generated-harness-contract.mjs`.
That contract is the source of truth for render gates, trusted generated
scripts, validation check dependencies, workspace-required files, and
consumer/workspace entrypoint participation.

The placeholder and public hygiene checks have no hardcoded private project
names. If you are extracting a harness from a private codebase, opt into leak
detection with a comma-separated list:

```sh
HARNESS_FORBIDDEN_PROJECT_TERMS="Internal Product,private-api" npm run check:placeholders
```

`npm run validate` adds the smoke-tested initialization flow and is the
default push/PR GitHub Actions path. The smoke test
creates disposable workspaces, generates harnesses for OpenAI-only,
Anthropic-only, and combined model settings, installs consumer entrypoints,
runs generated governance validation, bootstraps workspace pointers, and
verifies workspace layout.

Generated harness validation includes client-support checks when the relevant
surfaces are enabled:

- `scripts/check-codex-hooks.mjs` for generated Codex hooks
- `scripts/check-claude-compatibility.mjs` for generated Claude Code surfaces
- `scripts/check-overlay-drift.mjs` for model overlay routing

For a real project config, require configured consumer repo paths to exist:

```sh
node scripts/check-config.mjs --config harness.config.json --require-existing-consumers
```

## Structor Contributor Model

The recommended Structor contributor path should become:

```sh
npx @structor-dev/cli contribute structor
```

That future contributor bootstrap creates or refreshes a contributor workspace:
a local Structor source checkout plus a sibling Structor self-harness whose
consumer repository is Structor itself. The self-harness is repo-local guidance
for working on Structor; it does not change the generic generated harness model
for other projects.

The contributor bootstrap may clone local repositories when preparing that
workspace, but v1 must not fork repositories, push branches, open pull requests,
mutate GitHub or other external services, run agents, or become a runner.

The manual contributor setup path remains the clone-first fallback:

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm run setup:contributor
```

## Non-Goals

- No runner or orchestration runtime.
- No Linear, GitHub, Claude hook, or CI automation.
- No Codex runner automation beyond local harness hook guardrails.
- No live dashboards, polling loops, session control, auto-merge, repair
  daemons, or orchestration UI.
- Read-only generated Harness Cockpit views are allowed when they summarize
  canonical local files and do not execute validation, mutate state, or control
  workflows.
- No consumer implementation logic.
- No source-project or other project-specific content in active templates.

Structor is MIT-licensed so teams can generate, modify, and use harness
artifacts inside private or commercial repositories. Commercial policy packs,
private templates, tailored rollout support, or hosted services may be licensed
separately.
