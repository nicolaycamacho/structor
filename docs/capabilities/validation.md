# Validation

Structor validation is split between this package and generated harnesses.

## Structor Package Checks

Run:

```sh
npm run check:ci
npm run validate
```

`npm run check:ci` runs fast structural checks for local iteration and CI
hygiene, including config examples, shipped schemas, template files, task
template structure, contract manifests, placeholder hygiene, public hygiene,
model overlay thinness, and the docs manifest.

`npm run validate` runs `check:ci`, the Node test suite, and smoke-tested local
generation flows.

## Generated Harness Checks

Generated harness files are declared by Structor's generated harness contract.
Generated validation can include governance checks, workspace bootstrap checks,
workspace routing checks, model overlay drift checks, Codex hook checks, and
Claude compatibility checks when those surfaces are enabled.

Validation detects structural drift. It does not certify that all
project-specific guidance is complete or correct.
