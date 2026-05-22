{
  "id": "api-boundary",
  "name": "API Boundary Contract",
  "version": "1.0.0",
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": {{CONSUMER_REPO_NAMES_JSON}},
  "requiredFiles": [
    "ai/contracts/api-boundary.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
