import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Evaluator-only checks. Never copy this directory into an attempt workspace.
const [task, workspace] = process.argv.slice(2);
if (!["A", "B"].includes(task) || !workspace) {
  throw new Error("Usage: node acceptance.mjs <A|B> <workspace>");
}
const root = path.resolve(workspace);
const load = (file) => import(pathToFileURL(path.join(root, file)).href);
if (task === "A") {
  const { archivedCard, activeCard, queuedCard } = await load("example-frontend/src/cards.mjs");
  assert.equal(typeof archivedCard, "function");
  assert.deepEqual(archivedCard("  A\n  title  "), { state: "archived", title: "A title" });
  assert.deepEqual(archivedCard(""), { state: "archived", title: "" });
  assert.equal(Object.isFrozen(archivedCard("x")), true);
  assert.throws(() => archivedCard(null), TypeError);
  assert.throws(() => archivedCard(12), TypeError);
  assert.equal(activeCard("x").state, "active");
  assert.equal(queuedCard("x").state, "queued");
} else {
  const { serializeTicket } = await load("example-api/src/ticket.mjs");
  const { priorityLabel } = await load("example-frontend/src/priority.mjs");
  const schema = JSON.parse(await readFile(path.join(root, "example-api/contracts/ticket.json"), "utf8"));
  for (const [urgent, priority] of [[true, "high"], [false, "normal"], [undefined, "normal"], ["yes", "normal"]]) {
    const response = serializeTicket({ id: "t1", title: "Example", urgent, internal: "omit" });
    assert.deepEqual(response, { id: "t1", title: "Example", priority });
    assert.equal(priorityLabel(response), priority === "high" ? "High priority" : "Normal priority");
  }
  assert.deepEqual([...schema.required].sort(), ["id", "priority", "title"]);
  assert.equal(schema.properties.priority.type, "string");
  assert.deepEqual([...schema.properties.priority.enum].sort(), ["high", "normal"]);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties).sort(), ["id", "priority", "title"]);
}
console.log(`task ${task} acceptance: passed`);
