{
  "id": "api-boundary",
  "name": "API Boundary Contract",
  "version": "1.0.0",
  "maturity": {
    "level": "C0 Inventory",
    "scope": "Starter api boundary policy subject only",
    "limitations": [
      "Consumer applicability and source conformance have not been assessed"
    ]
  },
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": {{CONSUMER_REPO_NAMES_JSON}},
  "requiredFiles": [
    "ai/contracts/api-boundary.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
