# Populate Generated Harness Task

Use `ai/templates/populate-generated-harness-prompt.md` for the populate-generated-harness prompt.

{{GUIDANCE_MIGRATION_CONSUMER_SECTIONS}}

## Behavior

- If preserved guidance exists, use preserved guidance plus repo scan evidence.
- If no preserved guidance exists, use repo scan evidence only.
- This task is required before the harness is considered guidance-ready.
- Structor does not mechanically certify guidance readiness.

## Recommended Workflow

1. Run `structor init`.
2. Verify the generated harness bootstrap.
3. Populate the harness with repo analysis.
4. Validate the populated harness by checking navigation, references, and commands.
5. Write a final report with the verification evidence and remaining risks.

Use a frontier model such as GPT-5.5 or Opus 4.8 for the populate step. Manually
verify generated content, navigation, references, and commands before treating
the harness as guidance-ready.
