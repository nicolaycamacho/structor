{
  "id": "release-flow",
  "name": "Release Flow Contract",
  "version": "1.0.0",
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    "ai/VERSIONING.md",
    "ai/contracts/release-flow.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
