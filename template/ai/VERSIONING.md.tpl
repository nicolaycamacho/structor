# Versioning

Harness policy changes should preserve existing generated repo behavior unless
the task explicitly calls for a breaking change.

## Compatibility

- Keep existing script names stable.
- Add new validation as additive checks when possible.
- Document breaking changes in `ai/DECISIONS.md`.

## Release Boundary

The harness can define release criteria and evidence. It must not publish,
deploy, tag, or mutate remote systems unless a human explicitly authorizes that
action in the current task.
