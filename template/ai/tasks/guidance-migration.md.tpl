# Guidance Migration Task

Use `ai/templates/guidance-migration-prompt.md` for the migration prompt.

{{GUIDANCE_MIGRATION_CONSUMER_SECTIONS}}

## Behavior

- If preserved guidance exists, use preserved guidance plus repo scan evidence.
- If no preserved guidance exists, use repo scan evidence only.
- This task is required before the harness is considered guidance-ready.
- Structor does not mechanically certify guidance readiness.
