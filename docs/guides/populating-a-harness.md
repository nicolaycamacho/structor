# Populating A Harness

Generated harness population exists because Structor can install root
entrypoints that route agents through the generated harness while existing
repo-specific guidance may still contain useful local knowledge.

Setup completion and guidance readiness are separate:

```text
setup_complete: true
guidance_ready: false
```

`setup_complete: true` means Structor files, routing, and deterministic setup
gates completed. `guidance_ready: false` means the generated harness still
needs reviewed repo-specific conventions, contracts, validation expectations,
and workflow guidance before real implementation work should depend on it.

## Preserved Guidance

Preserved guidance is source material, not trusted canonical policy. Verify
paths, commands, architecture claims, ownership rules, and workflow
expectations against the current consumer repo before moving anything into the
harness.

Structor does not upload, analyze, merge, reinterpret, or delete preserved
files.

## Population Workflow

1. Run `structor init`.
2. Verify the generated harness bootstrap.
3. Open the generated task at `ai/tasks/populate-generated-harness.md`.
4. Use it with `ai/templates/populate-generated-harness-prompt.md`.
5. Compare preserved guidance against current repo evidence.
6. Migrate accepted guidance into canonical harness docs.
7. Validate generated content, navigation, references, and commands.
8. Write a final report with verification evidence and remaining risks.

Use a frontier model such as GPT-5.5 or Opus 4.8 for the interpretive
population task, then review the result manually.

After population is reviewed:

```text
setup_complete: true
guidance_ready: true
```
