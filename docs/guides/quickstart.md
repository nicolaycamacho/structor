# Quickstart

## Recommended: Install With Your Agent

Open your coding agent in the workspace folder that holds your repositories,
and paste the setup prompt from
[install with an agent](install-with-an-agent.md). The agent pins a Structor
commit, asks you a few decisions, and shows you the full plan. It writes
nothing until you approve that plan's exact hash.

## Fallback: npm CLI

The npm package is being deprecated in favor of the agent install. Use it
only for what the agent path does not cover yet: the `expanded` harness
profile, or regenerating a harness you already have. Run it from the
workspace folder that holds your repositories:

```sh
npx @structor-dev/cli init
```

`structor init` is local-only and deterministic. It does not call an LLM, make
API requests, install packages, create remotes, run agents, or modify external
services.

1. Confirm the detected repositories, or enter the paths you want.
2. Review the inferred project identity, generated harness directory, `focused`
   profile, selected agent clients, and validation command summary.
3. Review the dry-run preview of the generated harness plan.
4. Confirm generation only if the preview is correct.
5. If root guidance exists, choose preserve-and-replace or abort.
6. Let Structor install or verify entrypoints and run its completion gates.

### From A Local Clone

When developing Structor, run from the parent workspace:

```sh
node ./structor/bin/structor.mjs init
```

or, from inside this repository:

```sh
npm run init -- --workspace ..
```

## Next Step

Either path produces a harness with starter guidance. Setup finishing and the
guidance being ready are separate states. Populate the generated harness with
reviewed project-specific guidance before relying on it for real work; see
[populating a harness](populating-a-harness.md).
