import assert from "node:assert/strict";
import { activeCard, queuedCard } from "./src/cards.mjs";
import { priorityLabel } from "./src/priority.mjs";

assert.deepEqual(activeCard("  A   title "), { state: "active", title: "A title" });
assert.equal(Object.isFrozen(queuedCard("Queue")), true);
assert.throws(() => activeCard(null), TypeError);
assert.equal(priorityLabel({ priority: "high" }), "High priority");
console.log("frontend smoke: passed");
