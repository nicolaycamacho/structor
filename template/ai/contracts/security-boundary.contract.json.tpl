{
  "id": "security-boundary",
  "name": "Security Boundary Contract",
  "version": "1.0.0",
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": {{CONSUMER_REPO_NAMES_JSON}},
  "requiredFiles": [
    "ai/contracts/security-boundary.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
