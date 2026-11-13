{
  "id": "repo-boundaries",
  "name": "Repo Boundaries Contract",
  "version": "1.0.0",
  "maturity": {
    "level": "C0 Inventory",
    "scope": "Starter repo boundaries policy subject only",
    "limitations": [
      "Consumer applicability and source conformance have not been assessed"
    ]
  },
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    "ai/contracts/repo-boundaries.md",
    "ai/workspace/REPOS.md"
  ],
  "validation": ["node scripts/check-workspace.mjs"]
}
