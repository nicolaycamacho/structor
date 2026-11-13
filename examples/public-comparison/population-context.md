## Verified synthetic source map

This is a library-only synthetic ticket workspace, with no service or browser.
Source snapshot: frontend e9a2b46d6834703ed03c9ffb30171c33dfa4263a;
API 575d29897ba046835e70b04a6a0a64090f08b59d.

- example-frontend/README.md documents card-builder conventions.
- example-frontend/src/cards.mjs contains two analogous card builders and their
  shared factory; example-frontend/checks.mjs is a caller.
- example-frontend/src/priority.mjs reads the API priority field.
- example-api/src/ticket.mjs owns serialization; example-api/checks.mjs calls it.
- example-api/contracts/ticket.json is the API-owned response schema.
- Each package.json declares `npm test`, executing its local checks.mjs.

Read both repositories for boundary work, but edit only the repository named by
the task. Repository-local README.md and AGENTS.md remain preserved authorities.
No source is copied into this context map; recheck facts against the source.
