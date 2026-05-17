# Runner Readiness

This checklist is the gate before implementing any runner that consumes this
harness.

## Required Before Runner Work

- Harness validation passes.
- Task metadata is machine-checkable.
- Path contracts are documented.
- Dry-run artifact format is defined.
- First runner phase performs no external writes.
- Runtime state lives outside canonical docs.
- Protected surfaces remain human-gated.
