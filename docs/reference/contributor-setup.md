# Contributor Setup

The manual contributor setup path is for people who already cloned Structor
and want the local self-harness.

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm run setup:contributor -- --dry-run
npm run setup:contributor
```

The command generates or refreshes a sibling self-harness:

```text
workspace/
  structor/       # source repo contributors edit
  structor-self/  # generated Structor Self-Harness
```

## Safety Model

- The preset source lives in `contrib/self-harness/**`.
- Generated Structor-specific guidance is written to the sibling
  `structor-self` harness, not to active generic templates.
- The source repo is treated as the self-harness consumer repo.
- Source-repo pointer files are previewed before writes.
- Existing source `AGENTS.md`, `CLAUDE.md`, or other contributor entrypoints are
  skipped unless `--force` is passed.
- The manual path does not clone repositories, require GitHub authentication,
  push branches, open pull requests, or mutate external services.

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
