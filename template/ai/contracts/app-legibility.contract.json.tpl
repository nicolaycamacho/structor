{
  "id": "app-legibility",
  "name": "App Legibility Contract",
  "version": "1.0.0",
  "maturity": {
    "level": "C0 Inventory",
    "scope": "Starter app legibility policy subject only",
    "limitations": [
      "Consumer applicability and source conformance have not been assessed"
    ]
  },
  "owners": ["{{HARNESS_REPO_NAME}}"],
  "affectedRepos": {{CONSUMER_REPO_NAMES_JSON}},
  "requiredFiles": [
    "ai/contracts/app-legibility.md"
  ],
  "validation": ["node scripts/validate-governance.mjs"]
}
