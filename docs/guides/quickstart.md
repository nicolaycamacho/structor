# Quickstart

Run Structor from the workspace folder that contains your consumer repos:

```sh
npx @structor-dev/cli init
```

During local development from a clone of this repo, run from the parent
workspace:

```sh
node ./structor/bin/structor.mjs init
```

During local development from this repo, use:

```sh
npm run init -- --workspace ..
```

`structor init` is local-only and deterministic. It does not call an LLM, make
API requests, install packages, create remotes, run agents, or modify external
services.

## First Successful Path

1. Run `npx @structor-dev/cli init` from the parent workspace folder.
2. Confirm the detected consumer repositories, or enter the intended paths.
3. Review the inferred project identity, generated harness directory, `focused`
   profile, selected agent clients, and validation command summary.
4. Review the dry-run preview of the generated harness plan.
5. Confirm generation only if the preview is correct.
6. If root guidance exists, choose preserve-and-replace or abort.
7. Let Structor install or verify entrypoints and run deterministic completion
   gates.
8. Populate the generated harness with reviewed project-specific guidance
   before relying on it for real project work.

The generated harness starts with starter guidance. Setup completion and
guidance readiness are separate states; see
[populating a harness](populating-a-harness.md).
