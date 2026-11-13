import assert from "node:assert/strict";
import { serializeTicket } from "./src/ticket.mjs";

const response = serializeTicket({ id: "t1", title: "Example", internal: "omit" });
assert.equal(response.id, "t1");
assert.equal(response.title, "Example");
assert.equal("internal" in response, false);
console.log("API smoke: passed");
