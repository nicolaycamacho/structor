# Structor Init

`structor init` is the recommended first-run setup flow for a project workspace.
It is a local-only, deterministic terminal wizard for creating a
repository-local AI engineering harness. It does not call an LLM, make API
requests, install packages, create remotes, run agents, or modify external
services.

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

## First Successful Local Path

The default first-run path is:

1. Run `npx @structor-dev/cli init` from the parent workspace folder.
2. Confirm the workspace, project name, generated harness path, agent clients,
   and consumer repos.
3. Let Structor write `harness.config.json` only after reviewing the summary.
4. Review the dry-run preview of generated harness and consumer pointer files.
5. Confirm generation only if the preview is correct.
6. Run the next validation commands printed by the CLI.

During development from this repository, the equivalent local command is
`npm run init -- --workspace ..`.

This path creates a sibling generated harness repo with canonical `ai/*`
policy, thin Codex and Claude entrypoints, contracts, task templates, review
guidance, and local validation scripts. It does not create a runner or hosted
service; generated files remain local until you review and commit them.

## What It Reads

- The current workspace folder, or the folder passed with `--workspace`.
- Sibling folder names and local repo signals such as `.git`, `package.json`,
  `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`,
  `Gemfile`, and `composer.json`.
- Existing `harness.config.json`, if present.
- Local package metadata needed to suggest validation commands.

## What It Writes

Only after confirmation, it can write:

- `harness.config.json` in the selected workspace.
- A generated Structor repo at the configured `output.path`.
- Optional consumer entrypoint pointer files: `AGENTS.md`, `CLAUDE.md`, and
  `.claude/CLAUDE.md`.

Existing generated harness files and consumer entrypoints are skipped by the
underlying generator unless the user passes `--force`.

Consumer entrypoints are thin pointer files. They route Codex and Claude Code
back to the generated harness; they are not copies of the canonical harness
policy.

## What It Never Does

- No network calls.
- No LLM or API calls.
- No package installation in consumer repos.
- No `git init`, remote creation, branch publishing, or pull request work.
- No database, infrastructure, deployment, or external service mutation.
- No runner behavior such as polling, auto-repair loops, dashboards, or
  auto-merge.

If setup discovers a missing behavior or incorrect wizard behavior, track that
as a separate CLI issue instead of changing templates or generated behavior as
part of documentation work.

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
before any config is written.

## Generated Repo Name

The default generated repo folder is:

```text
<project-slug>-structor
```

Harness remains the category. Structor is the productized local harness
implementation.

## Config File

`harness.config.json` is Structor's project-specific input file. It records:

- project name, slug, and generated repo name
- output path
- Codex and Claude support flags
- consumer repo paths, purposes, and validation commands

Consumer repo paths are workspace-relative. The generator rejects absolute
consumer paths, `..` traversal, symlinked consumer paths, and entrypoint writes
to directories that do not look like repositories.

`structor generate --config harness.config.json` uses this file to render the
generated harness deterministically.

## Dry Run

Before generation, `structor init` runs the initializer in dry-run mode. This
prints the files that would be created or skipped without writing the generated
harness or consumer entrypoints. The user then confirms whether to apply the
plan.

## Customization Mode

The MVP supports `Starter only` content. It creates generic harness guidance and
does not infer real project contracts, coding conventions, or architecture from
consumer repo code.

`Light scan` and `Deep scan` are reserved for future opt-in features.

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
