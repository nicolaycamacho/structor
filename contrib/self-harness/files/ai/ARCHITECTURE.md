# Structor Architecture

This document maps the parts of the Structor source repo agents most often need
for narrow contribution work.

## System Shape

- `../structor/bin/structor.mjs`: public CLI commands and guided setup.
- `../structor/scripts/init-harness.mjs`: deterministic harness renderer.
- `../structor/scripts/lib.mjs`: config resolution, path boundaries, and write
  safety helpers.
- `../structor/scripts/generated-harness-contract.mjs`: generated artifact and
  validator contract.
- `../structor/scripts/rendered-config.mjs`: template value rendering.
- `../structor/template/**`: generic generated-harness templates.
- `../structor/schemas/**`: config and task schemas.
- `../structor/test/**`: regression coverage for CLI, config, rendering, and
  path safety.
- `../structor/contrib/self-harness/**`: Structor-specific self-harness source.

## Ownership Boundaries

- Generic generated policy belongs in `../structor/template/ai/*`.
- Structor-specific contributor guidance belongs in
  `../structor/contrib/self-harness/**` and the generated `structor-self`
  sibling.
- CLI convenience can prepare local files, but it must not clone, push, open PRs,
  require GitHub auth, or mutate remote services for this manual path.
- Path and write-safety changes belong close to `scripts/lib.mjs` and must have
  regression coverage.

## Change Guidance

- Keep issue work small and tied to the live issue acceptance criteria.
- Add regression tests for behavioral changes in scripts or validators.
- Prefer existing helpers over new abstractions.
- Treat `template/**/*.tpl` as shipped runtime surface, not inert docs.
- Validate generated output when changing templates or rendering behavior.
