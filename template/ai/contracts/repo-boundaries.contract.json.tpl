{
  "id": "repo-boundaries",
  "name": "Repo Boundaries Contract",
  "version": "1.0.0",
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    "ai/contracts/repo-boundaries.md",
    "ai/workspace/REPOS.md"
  ],
  "validation": ["node scripts/check-workspace.mjs"]
}
