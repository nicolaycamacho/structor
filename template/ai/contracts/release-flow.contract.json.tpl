{
  "id": "release-flow",
  "name": "Release Flow Contract",
  "version": "1.0.0",
  "maturity": {
    "level": "C0 Inventory",
    "scope": "Starter release flow policy subject only",
    "limitations": [
      "Consumer applicability and source conformance have not been assessed"
    ]
  },
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    "ai/VERSIONING.md",
    "ai/contracts/release-flow.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
