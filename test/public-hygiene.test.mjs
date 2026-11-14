import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

async function fixture(t, publicSourcePaths = ["package.json", "bin/"]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "structor-hygiene-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(repoRoot, "scripts"), path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, ".structor/manifest"), { recursive: true });
  await mkdir(path.join(root, "bin"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ private: true, type: "module" }));
  await writeFile(path.join(root, ".structor/manifest/repo-map.json"), JSON.stringify({ publicSourcePaths }));
  const check = () => {
    const result = spawnSync(process.execPath, ["scripts/check-public-hygiene.mjs"], { cwd: root, encoding: "utf8" });
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { root, check };
}

test("private checkout hygiene scans declared extensionless source without npm files metadata", async (t) => {
  const f = await fixture(t);
  assert.equal(f.check().status, 0);
  await writeFile(path.join(f.root, "bin/credential-fixture"), ["-----BEGIN ", "PRIVATE KEY-----"].join(""));
  const result = f.check();
  assert.equal(result.status, 1);
  assert.match(result.output, /bin\/credential-fixture contains a private key block/);
});

for (const [label, paths, pattern] of [
  ["missing declaration", undefined, /publicSourcePaths must be a non-empty array/],
  ["empty declaration", [], /publicSourcePaths must be a non-empty array/],
  ["missing path", ["missing/"], /Public source path does not exist/],
  ["traversal", ["../outside"], /relative paths without traversal/],
]) {
  test(`public checkout hygiene fails closed for ${label}`, async (t) => {
    const f = await fixture(t, paths);
    if (paths === undefined) {
      await writeFile(path.join(f.root, ".structor/manifest/repo-map.json"), "{}");
    }
    const result = f.check();
    assert.equal(result.status, 1);
    assert.match(result.output, pattern);
  });
}
