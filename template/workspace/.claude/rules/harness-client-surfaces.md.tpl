---
paths:
  - "AGENTS.md"
  - "CLAUDE.md"
  - ".claude/**"
  - "{{HARNESS_REPO_NAME}}/**"
---

# Workspace Client Surface Rules

- Treat `{{HARNESS_REPO_NAME}}/ai/*` as the canonical harness guidance.
- Keep workspace-level `AGENTS.md`, `CLAUDE.md`, and `.claude/**` as thin
  pointers to the generated harness.
- Do not copy full harness policy into the workspace root.
- Review existing workspace files before using bootstrap `--force`.
