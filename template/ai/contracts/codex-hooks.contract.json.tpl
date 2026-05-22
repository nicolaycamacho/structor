{
  "id": "codex-hooks",
  "name": "Codex Hooks Contract",
  "version": "1.0.0",
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    ".codex/hooks.json",
    "scripts/hooks/codex-hook.mjs",
    "scripts/hooks/lib/codex-hooks-core.mjs",
    "ai/contracts/codex-hooks.md"
  ],
  "forbiddenTokens": ["fetch(", "writeFile(", "appendFile("],
  "validation": ["node scripts/check-codex-hooks.mjs"]
}
