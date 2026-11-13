# App Legibility

Maturity is declared in the sibling manifest. Read `ai/contracts/README.md`
for the model and limits before relying on this starter as a project contract.

Consumer repos must expose enough local information for agents to inspect and
validate work without guessing.

## Expected Local Signals

- install command
- lint command
- test command
- build command
- health or smoke-check command when available
- required environment variable documentation
- artifact or log locations when validation creates them

## Validation Evidence Shape

Final reports should include:

- commands run
- commands skipped and why
- affected repos and contract IDs
- protected surfaces reviewed
- artifact or log paths when produced
