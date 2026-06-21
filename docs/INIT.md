# Structor Init

`structor init` is the recommended first-run setup flow for a project
workspace. It is a local-only, deterministic terminal wizard for creating a
Repository-local AI Engineering Harness. It does not call an LLM, make API
requests, install packages, create remotes, run agents, or modify external
services.

This manual describes the planned safe guidance takeover flow. If current CLI
behavior differs, treat that as implementation work outside this documentation
issue.

## Recommended Command

Run from the workspace folder that contains your consumer repos:

```sh
npx @structor-dev/cli init
```

During local development from a clone of this repo, use
`node ./structor/bin/structor.mjs init` from the parent workspace instead.

During local development from this repo, use:

```sh
npm run init -- --workspace ..
```

The current CLI supports `init`, `generate`, and `doctor`. It does not include a
runner command.

## Commands

`structor init` is the normal first-run path. It gathers the workspace inputs,
previews the transaction, handles root guidance consent, writes the generated
harness, installs or verifies entrypoints, runs deterministic completion gates,
and leaves any interpretive guidance migration as local post-init work.

`structor generate` is the lower-level deterministic renderer. It reads an
existing `harness.config.json` and renders the generated harness from committed
templates. Use it when you already have a reviewed config or need to preview the
rendered file plan with a dry run.

`structor doctor` is the inspection path. It should report local setup and
guidance-readiness signals without becoming a repair loop, workflow runner, or
agent coordinator.

## First Successful Local Path

The default first-run path is:

1. Run `npx @structor-dev/cli init` from the parent workspace folder.
2. Confirm the workspace and detected consumer repositories. With one detected
   repo, press Enter to use it. With multiple detected repos, press Enter to use
   all detected repos.
3. Review the inferred project identity and validation command summary, then
   confirm the generated harness directory.
4. Confirm the highlighted default agent clients, or enter `1`, `2`, or `3`
   when scripting stdin.
5. Let Structor detect existing root guidance in each selected consumer repo.
6. Review the setup summary, including the durable harness-local
   `harness.config.json` path, entrypoint writes, and completion gates.
7. Review the dry-run preview of the generated harness plan.
8. Confirm generation only if the preview is correct.
9. If root guidance exists, consent to preserve-and-replace or abort setup.
10. Let Structor install or verify consumer and workspace entrypoints, then run
   generated governance and workspace completion gates before success.
11. Use the generated populate-generated-harness task with a frontier model such
   as GPT-5.5 or Opus 4.8 to migrate preserved guidance into canonical harness
   docs before relying on the harness for real project work.
12. Manually verify generated content, navigation, references, and commands,
   then write a final report with verification evidence and remaining risks.

During development from this repository, the equivalent local command is
`npm run init -- --workspace ..`.

This path creates a sibling generated harness repo with canonical `ai/*`
policy, thin Codex and Claude entrypoints, contracts, task templates, review
guidance, and local validation scripts. It does not create a runner or hosted
service; generated files remain local until you review and commit them.

## Workspace Detection

Structor works best when run from a parent workspace folder:

```text
workspace/
  project-frontend/
  project-api/
```

It suggests sibling folders as consumer repos only when it finds strong local
signals such as `.git`, `package.json`, `pyproject.toml`, or `go.mod`. It
excludes hidden folders, `node_modules`, `structor`, and likely generated
folders such as `*-structor`, `*-harness`, and `*-engineering-harness`.

The detected list is only a suggestion. The user confirms the selected repos
before any config is written. If the detected repos are rejected, the wizard
falls back to manual consumer repo path entry.

Detected consumer repos use inferred names, purposes, and validation commands.
The wizard summarizes found validation commands and marks missing commands as
`not found` or `not configured`; it does not prompt for per-repo command text on
the detected-repo happy path.

The default generated repo folder is:

```text
<project-slug>-structor
```

Harness remains the category. Structor is the productized local harness
implementation. During `init`, the generated harness location is collected with
one prompt:

```text
Harness directory [./<project-slug>-structor]:
```

The directory basename becomes `project.harnessRepoName`; the project slug is
stored as that basename without the `-structor` suffix. A basename without the
recommended `-structor` suffix is allowed but warned.

## What It Reads

- The current workspace folder, or the folder passed with `--workspace`.
- Sibling folder names and local repo signals such as `.git`, `package.json`,
  `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`,
  `Gemfile`, and `composer.json`.
- Existing `harness.config.json`, if present.
- Local package metadata needed to suggest validation commands.
- Existing root `AGENTS.md` and `CLAUDE.md` files in selected consumer repos.
- Broader local guidance candidates that may need later human review.

## What It Writes

Only after confirmation, it can write:

- `harness.config.json` inside the generated harness.
- A generated Structor repo at the configured `output.path`.
- Required consumer entrypoint pointer files: `AGENTS.md` and `CLAUDE.md` when
  the selected model support enables them.
- Required workspace entrypoint pointer files owned by the generated harness
  bootstrap contract.
- Preserved root guidance under `.structor/preserved-guidance/<timestamp>/`
  inside the consumer repo after explicit consent.
- A local populate-generated-harness task describing the guidance review still
  required after deterministic setup.

Consumer entrypoints are thin pointer files. They route Codex and Claude Code
back to the generated harness; they are not copies of the canonical harness
policy.

## Existing Root Guidance

Root guidance means top-level `AGENTS.md` and `CLAUDE.md` files in a consumer
repo. In the planned safe takeover flow, Structor checks for those files before
writing root entrypoints.

If no root guidance exists, Structor can generate root entrypoints, generate
the harness, create the populate-generated-harness task, report deterministic
setup complete, and still mark harness population required.

If existing root guidance is found, Structor asks for consent and offers only
two outcomes:

- preserve existing guidance as consumer-local source material and generate
  Structor entrypoints
- abort setup

Preserved guidance uses this shape:

```text
<consumer>/
  .structor/
    preserved-guidance/
      <timestamp>/
        AGENTS.md
        CLAUDE.md
        manifest.json
```

Preserved guidance is local source material, not canonical harness policy.
Broader guidance candidates may be listed in the manifest, but tool-local state
directories such as `.claude/*`, `.cursor/*`, `.codex/*`, and `.ai/*` should
not be blindly copied wholesale.

## What It Never Does

- No network calls.
- No LLM or API calls.
- No package installation in consumer repos.
- No `git init`, remote creation, branch publishing, or pull request work.
- No database, infrastructure, deployment, or external service mutation.
- No runner behavior such as polling, auto-repair loops, dashboards, or
  auto-merge.
- No silent deletion, upload, reinterpretation, or automatic merge of preserved
  guidance.
- No automatic interpretive migration from preserved guidance into canonical
  harness policy.

If setup discovers a missing behavior or incorrect wizard behavior, track that
as a separate CLI issue instead of changing templates or generated behavior as
part of documentation work.

## Config File

`harness.config.json` is Structor's project-specific input file. It records:

- workspace root semantics for workspace-relative topology paths when the
  config lives inside the generated harness
- project name, slug, and generated repo name
- output path
- Codex and Claude support flags
- consumer repo paths, purposes, and validation commands

Consumer repo paths and the durable init `output.path` remain workspace-relative
even when the config is stored inside the generated harness. The generator
rejects absolute consumer paths, `..` traversal, symlinked consumer paths, and
entrypoint writes to directories that do not look like repositories.

`structor generate --config harness.config.json` uses this file to render the
generated harness deterministically.

## Dry Run

Before generation, `structor init` runs the initializer in dry-run mode. This
prints the files that would be created or skipped without writing the generated
harness or consumer entrypoints. The user then confirms whether to apply the
plan.

## Non-Interactive Behavior

Non-interactive setup should stay conservative. At a documentation level, a
non-interactive run can proceed only when it has enough explicit configuration
and consent to apply the planned writes safely. If existing root guidance is
present and preserve-and-replace consent has not been provided, setup should
abort instead of guessing.

## Customization Mode

The MVP supports `Starter only` content. It creates generic harness guidance and
does not infer real project contracts, coding conventions, or architecture from
consumer repo code.

`Light scan` and `Deep scan` are reserved for future opt-in features.

## Setup Completion And Guidance Readiness

Deterministic setup completion and guidance readiness are different states:

```text
setup_complete: true
guidance_ready: false
```

`setup_complete: true` means Structor files, entrypoint routing, generated
governance checks, and workspace completion gates passed.

`guidance_ready: false` means the generated harness still needs reviewed
repo-specific conventions, contracts, validation expectations, and workflow
guidance before real implementation work should depend on it.

Recommended post-init workflow:

1. Run `structor init`.
2. Verify the generated harness bootstrap.
3. Populate the harness with repo analysis.
4. Validate the populated harness by checking navigation, references, and
   commands.
5. Write a final report with verification evidence and remaining risks.

After the user runs and manually verifies the local populate-generated-harness
task:

```text
setup_complete: true
guidance_ready: true
```

Structor does not run interpretive migration itself. It generates local
population guidance/task material; the user runs that task locally with their
preferred agent, preferably a frontier model such as GPT-5.5 or Opus 4.8, and
manually verifies the result.

## Validation Split

Use the Structor package scripts from `package.json`:

```sh
npm run check:ci
npm run validate
```

`npm run check:ci` runs the fast structural checks used for local iteration and
CI hygiene.

`npm run validate` runs `check:ci`, the Node test suite, and the smoke-tested
initialization flow that generates disposable harnesses and verifies generated
governance and workspace routing.
