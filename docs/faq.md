# FAQ

## Is Structor a runner?

No. Structor creates local files and validators. It does not run agents, open
pull requests, shepherd CI, auto-repair code, or operate a control plane. See
[harness vs runner](concepts/harness-vs-runner.md).

## Does init call LLMs or external services?

No. `structor init` is local-only and deterministic. It does not call LLMs,
make API requests, install packages, create remotes, run agents, or mutate
external services.

## What command should I run first?

Run from the workspace folder that contains your consumer repos:

```sh
npx @structor-dev/cli init
```

See [quickstart](guides/quickstart.md).

## What does Structor generate?

It generates a sibling harness repo with canonical `ai/*` policy, thin Codex
and Claude entrypoints, contracts, task guidance, and validation scripts. See
[generated files](reference/generated-files.md).

## Where do I put project-specific guidance?

After setup, migrate reviewed project-specific guidance into the generated
harness under `ai/*`. Preserved guidance is source material, not canonical
policy. See [populating a harness](guides/populating-a-harness.md).

## What if my repo already has AGENTS.md or CLAUDE.md?

Structor should preserve existing root guidance after explicit consent and
replace it with thin generated entrypoints, or abort setup. It should not
silently delete, upload, interpret, or merge existing guidance. See
[safe agent workflows](capabilities/safe-agent-workflows.md).

## How do I validate the generated harness?

Run generated harness scripts from the generated harness repo, including
governance and workspace checks. See [validation](capabilities/validation.md)
and [troubleshooting](guides/troubleshooting.md).

## Can I use Structor with Codex and Claude Code?

Yes. Structor can generate Codex and Claude Code entrypoints. Some Claude
surfaces, including hooks and skills, are deferred. See
[choosing agent clients](guides/choosing-agent-clients.md).

## How do I inspect or recover from setup problems?

Start with [troubleshooting](guides/troubleshooting.md). Use `structor doctor`
for inspection, not repair automation.

## Where do contributor setup docs live?

See [contributor setup](reference/contributor-setup.md).
