# Structor Contributor Setup

The recommended contributor setup is the one-command workspace bootstrap:

```sh
npx @structor-dev/cli contribute structor
```

Run it from the parent folder where you want Structor development to live. It
creates or refreshes:

```text
workspace/
  structor/       # source repo contributors edit
  structor-self/  # generated Structor Self-Harness
```

The point of the self-harness is developer-facing: before an agent edits
Structor, Structor creates the repo-specific guidance layer that teaches the
agent how to work here. The source repo remains the code you edit; the sibling
self-harness owns canonical guidance, routing, and validation for work on
Structor itself.

This is distinct from normal user setup for target repos:

```sh
npx @structor-dev/cli init
```

Use `structor init` when you want Structor to generate a harness for another
project. Use `structor contribute structor` when you want to work on Structor
itself.

## Safety Model

- The preset source lives in `contrib/self-harness/**`.
- Generated Structor-specific guidance is written to the sibling
  `structor-self` harness, not to active generic templates.
- The source repo is treated as the self-harness consumer repo.
- Source-repo pointer files are previewed before writes.
- Existing source `AGENTS.md`, `CLAUDE.md`, or other contributor entrypoints are
  skipped unless `--force` is passed.
- The contributor command may clone the public source repository, but that is
  network-read-only.
- The contributor command does not create forks, push branches, open pull
  requests, edit issues, require GitHub authentication, run agents, or mutate
  external services in v1.
- After the local workspace is ready, contributors can still fork, branch, push,
  and open PRs with normal GitHub workflows.

## Manual Clone-First Path

Use the manual path when you already have a Structor clone or want to control
the clone step yourself:

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm install
npm run setup:contributor -- --dry-run
npm run setup:contributor
```

The manual setup script does not clone repositories, require GitHub
authentication, push branches, open pull requests, edit issues, run agents, or
mutate external services.

## Validation

After setup:

```sh
npm run validate
cd ../structor-self
node scripts/validate-governance.mjs
node scripts/check-workspace.mjs
```

Use `--force` only after reviewing the preview and deciding to replace existing
source-repo pointer files.

## Troubleshooting

### Existing folders

If `workspace/structor` already exists, the contributor command reuses it only
when it is a usable Structor checkout. If the folder exists but is not Structor,
move it aside or choose a different `--workspace`.

### Skipped entrypoints

Existing source-repo `AGENTS.md`, `CLAUDE.md`, `.codex/**`, and `.claude/**`
entrypoints are skipped by default. Review the dry-run output before using
`--force`, because `--force` allows the setup to replace those local pointers.

### Validation failures

Run validation from the source repo first:

```sh
npm run validate
```

Then validate the self-harness:

```sh
cd ../structor-self
node scripts/validate-governance.mjs
node scripts/check-workspace.mjs
```

If the self-harness checks fail, rerun the contributor setup from the source
repo and inspect any skipped files in the output.

### Rerunning setup

The setup is designed to be rerun. Use a dry run when you want to preview the
next refresh:

```sh
npx @structor-dev/cli contribute structor --dry-run
```

From an existing source clone, the equivalent manual preview is:

```sh
npm run setup:contributor -- --dry-run
```

The contributor setup remains a generator and guidance layer. It is not a
runner, orchestrator, PR bot, or external-service automation.
