# Example API

Synthetic ticket response serializer. Run `npm test`; no installed dependencies,
server, credentials or network are needed.

`src/ticket.mjs` owns the wire response. `contracts/ticket.json` is the API-owned
response schema, consumed by the sibling example-frontend. Change the serializer
and its contract together. Extra internal input fields must not leak to the wire.
