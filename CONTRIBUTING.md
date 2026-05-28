# Contributing to Structor

Structor is early, experimental infrastructure for harness engineering. Issues,
questions, and pull requests are welcome, but the project is intentionally
narrow.

## Scope

Structor generates repository-local AI engineering harnesses. It is not a
runner, orchestrator, or agent runtime. Polling, PR automation, dashboards,
auto-merge, and external service mutation are out of scope for the core
template.

If you are unsure whether a change fits, open an issue describing the problem
before writing code.

## Local Development

Requirements: Node.js 20 or newer. No other dependencies.

```sh
git clone https://github.com/wari1986/structor.git
cd structor
npm install
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

## Reporting Bugs

Use the bug report issue template. Include your Node version, the command you
ran, and the full output. If it involves generation, include a minimal
`harness.config.json` that reproduces it.

## Security

Do not file public issues for anything that could expose secrets or enable
unsafe file operations. Contact the maintainer privately first.
