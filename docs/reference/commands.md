# Commands

The current CLI supports `init`, `agent`, `generate`, `contribute structor`,
and `doctor`. It does not include a runner command.

## `structor init`

Guided local setup for a Structor workspace:

```sh
npx @structor-dev/cli init
```

Useful options include:

- `--workspace <path>`
- `--config <path>`
- `--yes`
- `--preserve-existing-guidance`

`--yes` is not permission to replace existing non-matching root guidance. Use
`--preserve-existing-guidance` only when preserve-then-replace is explicitly intended.

## `structor agent`

Produce, hash, and apply the immutable Agent-Native Setup contract:

```sh
structor agent plan --workspace <path> --config-draft <path> \
  --plan-id <id> --source-revision <40-character-sha>
structor agent hash --plan <installation-plan.json>
structor agent apply --workspace <path> --config-draft <path> \
  --plan <installation-plan.json> --approval <approval-receipt.json>
```

The plan command emits JSON without mutating the selected workspace. Apply
requires an approval receipt bound to the exact canonical plan hash. Most users
should not call these directly: paste the prompt from
[install with an agent](../guides/install-with-an-agent.md) and let a coding
agent drive them. See [Install Structor With An Agent](../../INSTALL_WITH_AGENT.md)
for the complete model-neutral protocol.


## `structor generate`

Render a generated harness from an existing config:

```sh
npx @structor-dev/cli generate --config harness.config.json --dry-run
npx @structor-dev/cli generate --config harness.config.json --install-consumer-entrypoints
```

Use it when you already have a reviewed `harness.config.json` or need to
preview the rendered file plan.

## `structor doctor`

Inspect local Structor workspace drift:

```sh
npx @structor-dev/cli doctor --workspace .
```

`doctor` reports local setup and guidance-readiness signals. It is not a repair
loop, workflow runner, or agent coordinator.

Inspect one checkout without checking unrelated consumers, workspace pointers,
or auxiliary worktrees:

```sh
structor doctor --workspace . --target ./app
structor doctor --config ./project-structor/harness.config.json --target ./app --json
structor doctor --workspace . --target ./app --require-git-freshness
```

`--target` paths resolve from the command's current directory. Configuration
discovery and durable `workspace.root` semantics stay unchanged. `--json` and
`--require-git-freshness` require `--target`.

The shared diagnostic result reports the physical target root, expected and
actually referenced harness roots, HEAD and upstream revisions, branch,
detached state, Git-visible dirty state, and upstream relationship (`equal`,
`ahead`, `behind`, `diverged`, or `unavailable`). Enabled consumer entrypoints,
their declared harness references, and baseline `ai/AGENTS.md`, `ai/HUB.md`,
and `ai/context.md` receive SHA-256 fingerprints of current file bytes.
Missing or unsafe files have no fingerprint. This inventory does not traverse
the full guidance graph or prove guidance correctness or agent adoption.

Upstream comparisons use **cached local refs**. Live freshness is always marked
unavailable: diagnostics never fetch, synchronize, repair, switch branches,
delete worktrees, or write checkouts. Git optional locks, filesystem monitors,
and lazy object fetching are disabled for evidence collection.
Checkouts with configured clean/process filters or indexed submodules retain
revision and ancestry evidence, but dirty state is unavailable: collecting it
could execute external filters and write files. No filter is executed.

Ordinary inspection exits 0 when selected routing and fingerprints are valid,
even if Git is unavailable, dirty, behind, or diverged. The explicit Git gate
additionally requires both target and referenced harness to have complete,
clean Git evidence with a configured upstream and an `equal` or `ahead`
relationship. Missing commits/upstream refs, detached HEAD, shallow history,
dirty or unavailable dirty state, or stale/diverged sources fail that gate.
All diagnostic failures exit 1. Passing this gate proves readiness against
cached refs only.

Expanded generated harnesses expose the same result and exit rules:

```sh
node scripts/check-worktrees.mjs --target ../app --json
node scripts/check-worktrees.mjs --target ../app --require-git-freshness
```

Existing unscoped worktree discovery, `--include-canonical`, `--strict`, and
`--no-worktree-list` behavior is unchanged. Focused harnesses retain Doctor
support without adding expanded worktree commands. Existing generated projects
gain these scripts only through explicit regeneration.

## `structor contribute structor`

Create or refresh a local Structor contributor workspace:

```sh
npx @structor-dev/cli contribute structor
```

See [contributor setup](contributor-setup.md) for the manual fallback.

## Generated Submission Validators

Inside a generated harness (either profile):

```sh
node scripts/check-issue-template.mjs --file ../issue.md
node scripts/check-task-template.mjs --file ../task.md
```

See [validation](../capabilities/validation.md#validate-a-concrete-issue-or-task)
for task sizes, supported metadata, no-argument behavior and exit codes.
