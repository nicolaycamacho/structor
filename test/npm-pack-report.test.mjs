import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePackReport } from "../scripts/npm-pack-report.mjs";

const expectedPackage = { name: "@example/cli", version: "1.2.3" };
const packed = {
  ...expectedPackage,
  filename: "example-cli-1.2.3.tgz",
  files: [{ path: "bin/cli.mjs" }, { path: "package.json" }],
};

test("pack report selects the exact package from npm array and package-keyed reports", () => {
  for (const report of [[packed], { "@example/cli": packed }]) {
    assert.deepEqual(parsePackReport(JSON.stringify(report), expectedPackage), packed);
  }
});

test("pack report rejects empty, malformed, unexpected and ambiguous results with context", () => {
  for (const output of ["", "   ", "npm notice\n[]", "{", "null", "42", '"report"', "true",
    "[]", "{}", JSON.stringify(packed), JSON.stringify([null]), JSON.stringify([packed, packed]),
    JSON.stringify({ "@example/cli": packed, other: packed }),
    JSON.stringify({ other: packed }), JSON.stringify({ "@example/cli": [packed] }),
  ]) {
    assert.throws(() => parsePackReport(output, expectedPackage), /npm pack --json: /, output);
  }
});

test("pack report rejects wrong identity, unsafe filenames and malformed file inventories", () => {
  for (const changes of [
    { name: "other" }, { version: "9.9.9" }, { name: undefined }, { version: undefined },
    { filename: undefined }, { filename: "" }, { filename: "../other.tgz" },
    { filename: "/tmp/other.tgz" }, { filename: "nested/other.tgz" },
    { filename: "..\\other.tgz" }, { filename: "other.tar" }, { filename: "bad\n.tgz" },
    { files: undefined }, { files: [] }, { files: {} }, { files: [null] },
    { files: [{}] }, { files: [{ path: "" }] }, { files: [{ path: "../package.json" }] },
    { files: [{ path: "/package.json" }] }, { files: [{ path: "bin\\cli.mjs" }] },
    { files: [{ path: "package.json" }, { path: "package.json" }] },
  ]) {
    for (const report of [[{ ...packed, ...changes }], { "@example/cli": { ...packed, ...changes } }]) {
      assert.throws(() => parsePackReport(JSON.stringify(report), expectedPackage), /npm pack --json: /);
    }
  }
});
