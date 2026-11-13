{
  "id": "github-safety",
  "name": "GitHub Safety Contract",
  "version": "1.0.0",
  "maturity": {
    "level": "C0 Inventory",
    "scope": "Starter github safety policy subject only",
    "limitations": [
      "Consumer applicability and source conformance have not been assessed"
    ]
  },
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": ["{{HARNESS_REPO_NAME}}"],
  "requiredFiles": [
    "ai/contracts/github-safety.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
