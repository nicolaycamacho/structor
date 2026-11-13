# Example frontend

Synthetic ticket-card library. No browser or installed dependencies are needed.
Run `npm test` for the existing smoke checks.

`src/cards.mjs` owns card presentation. New card builders follow the two
existing builders: use the shared title normalizer and frozen card factory;
preserve their input errors, key shape and immutable results.
`src/priority.mjs` consumes the API's `priority` wire field. The API repository
owns the response contract; do not duplicate its schema here.
