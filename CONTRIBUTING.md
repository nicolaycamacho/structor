# Contributing to Structor

Structor is early, experimental infrastructure for Harness Engineering. Issues,
questions, and pull requests are welcome, but the project is intentionally
narrow.

## Scope

Structor generates Repository-local AI Harness Engineering Frameworks. It is not a
runner, orchestrator, or agent runtime. Polling, PR automation, dashboards,
auto-merge, and external service mutation are out of scope for the core
template.

If you are unsure whether a change fits, open an issue describing the problem
before writing code.

## Contributor Paths

Clone Structor first, then invoke the contributor bootstrap from that checkout:

```sh
git clone https://github.com/nicolaycamacho/structor.git
node ./structor/bin/structor.mjs contribute structor --workspace ./contributor-workspace
```

The contributor bootstrap creates or refreshes a contributor workspace:
the Structor source repository plus a sibling Structor self-harness. It may
clone local repositories for the workspace, but it must not fork repositories,
push branches, open pull requests, mutate GitHub or other external services, run
agents, or become a runner in v1.

The manual contributor setup path remains available for contributors who prefer
the conventional clone-first workflow:

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm run setup:contributor
```

## Local Development

Requirements: Node.js 20 or newer, npm 10 or newer, and Git for pinned-checkout
smoke checks. No runtime package dependencies. Use a Node/npm pair
supported by npm itself. The Linux CI reference pairs are Node 20/npm 10,
Node 22/npm 10, Node 24/npm 11, and Node 24/npm 12; each runs the complete
`npm run validate` gate. Node 24.22.1/npm 12.2.2 is also a local validation
reference. The minimum Node version remains 20. Other compatible pairs above
these minimums are not individually covered by the matrix.

See [contributor setup](docs/reference/contributor-setup.md#toolchains-and-ci)
for check names and required-check configuration.

```sh
git clone https://github.com/nicolaycamacho/structor.git
cd structor
npm ci
npm run validate
```

Useful subsets while iterating:

```sh
npm run check:ci
npm test
npm run check:smoke
```

## Pull Request Checklist

- `npm run validate` passes locally.
- New pure logic has unit tests under `test/`.
- Template files stay generic, with no project-specific or private product
  content.
- Model overlays and consumer entrypoints stay thin.
- The harness/runner boundary is preserved.
- Any new generated file is added to the relevant template and governance
  checks.
- Issues and pull requests use the structured GitHub labels: one `type:*`, one
  or more `area:*`, one `risk:*`, and a `status:*` label when the workflow
  state is known.

## Reporting Bugs

Use the bug report issue template. Include your Node version, the command you
ran, and the full output. If it involves generation, include a minimal
`harness.config.json` that reproduces it.

## Security

Do not file public issues for anything that could expose secrets or enable
unsafe file operations. Contact the maintainer privately first.

Release maintainers: follow the [tagged release process](docs/reference/releases.md).
