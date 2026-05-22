{
  "id": "github-safety",
  "name": "GitHub Safety Contract",
  "version": "1.0.0",
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    "ai/contracts/github-safety.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
