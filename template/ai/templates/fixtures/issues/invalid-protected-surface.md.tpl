---
id: HARNESS-FIXTURE-002
status: Ready for Agent
risk: medium
autonomy: pr_ready
model_policy: standard
repos:
  - {{HARNESS_REPO_NAME}}
allowed_paths:
  - ai/RUNNER-SAFETY.md
forbidden_paths:
  - workspace/**
requires_human_approval: false
---

# Invalid Protected Surface Fixture

## Summary

This fixture mentions auth, billing, secrets, and database migration work
without requiring human approval.
