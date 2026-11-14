import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Match CLI fixture isolation for construction and nested checker Git commands.
const fixtureGitEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_ATTR_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
};
const fixtureGitConfig = {
  "core.hooksPath": "/dev/null",
  "core.attributesFile": "/dev/null",
  "core.autocrlf": "false",
  "commit.gpgSign": "false",
  "tag.gpgSign": "false",
  "init.templateDir": "",
  "init.defaultBranch": "main",
};
fixtureGitEnv.GIT_CONFIG_COUNT = String(Object.keys(fixtureGitConfig).length);
Object.entries(fixtureGitConfig).forEach(([key, value], index) => {
  fixtureGitEnv[`GIT_CONFIG_KEY_${index}`] = key;
  fixtureGitEnv[`GIT_CONFIG_VALUE_${index}`] = value;
});

const source = fileURLToPath(new URL("../scripts/check-release.mjs", import.meta.url));
async function fixture(t, { git = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "structor-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"));
  await copyFile(source, path.join(root, "scripts/check-release.mjs"));
  const write = (name, content) => writeFile(path.join(root, name), content);
  await write("package.json", JSON.stringify({ version: "0.3.0" }));
  await write("package-lock.json", JSON.stringify({ version: "0.3.0", packages: { "": { version: "0.3.0" } } }));
  await write("CHANGELOG.md", "# Changelog\n\n## [0.3.0] - 2026-11-14\n\n- Tagged distribution.\n");
  const runGit = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8", env: fixtureGitEnv }).trim();
  if (git) {
    runGit("init", "-b", "main");
    runGit("config", "user.name", "Release Fixture");
    runGit("config", "user.email", "fixture@example.invalid");
    runGit("config", "commit.gpgsign", "false");
    runGit("config", "tag.gpgSign", "false");
    runGit("add", "."); runGit("commit", "-m", "release fixture");
    runGit("update-ref", "refs/remotes/origin/main", "HEAD");
  }
  const check = (args = [], overrides = {}) => {
    const env = { ...fixtureGitEnv };
    delete env.GITHUB_REF_TYPE; delete env.GITHUB_REF_NAME;
    Object.assign(env, overrides);
    const result = spawnSync(process.execPath, [path.join(root, "scripts/check-release.mjs"), ...args], { cwd: root, env, encoding: "utf8" });
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { root, write, git: runGit, check };
}

test("release metadata check works without Git and tag verification fails closed without it", async (t) => {
  const f = await fixture(t, { git: false });
  assert.equal(f.check().status, 0);
  assert.equal(f.check(["--tag", "v0.3.0"]).status, 1);
});

test("release CLI accepts an annotated main tag and automatically checks CI tag builds", async (t) => {
  const f = await fixture(t);
  f.git("tag", "-a", "v0.3.0", "-m", "Structor 0.3.0");
  assert.equal(f.check(["--tag", "v0.3.0"]).status, 0);
  assert.equal(f.check([], { GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "v0.3.0" }).status, 0);
  assert.equal(f.check([], { GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "v0.9.0" }).status, 1);
});

for (const [name, content, pattern] of [
  ["package.json", '{"version":"0.3.0-rc.1"}', /stable X.Y.Z/],
  ["package-lock.json", 'null', /root versions must match/],
  ["package-lock.json", '{"version":"0.2.4","packages":{"":{"version":"0.3.0"}}}', /root versions must match/],
  ["package-lock.json", '{"version":"0.3.0","packages":{"":{"version":"0.2.4"}}}', /root versions must match/],
  ["CHANGELOG.md", "## [0.2.0] - 2026-06-03\n\n- Old release.\n", /dated entry for 0.3.0/],
  ["CHANGELOG.md", "## [0.3.0] - 2026-11-14\n\n", /nonempty dated entry/],
  ["CHANGELOG.md", "## [0.3.0] - 2026-11-14\n- First\n## [0.3.0] - 2026-11-14\n- Duplicate\n", /exactly one/],
]) {
  test(`release CLI rejects metadata drift: ${name} ${pattern.source}`, async (t) => {
    const f = await fixture(t);
    await f.write(name, content);
    const result = f.check();
    assert.equal(result.status, 1); assert.match(result.output, pattern);
  });
}

test("release CLI rejects lightweight tags, wrong versions, missing refs, and invalid arguments", async (t) => {
  const f = await fixture(t);
  f.git("tag", "v0.3.0");
  assert.match(f.check(["--tag", "v0.3.0"]).output, /annotated tag/);
  f.git("tag", "-a", "v0.4.0", "-m", "wrong version");
  assert.match(f.check(["--tag", "v0.4.0"]).output, /does not match/);
  assert.equal(f.check(["--tag", "v0.3.0^{commit}"]).status, 1);
  assert.equal(f.check(["--tag", "v9.0.0"]).status, 1);
  assert.equal(f.check(["--typo"]).status, 1);
  f.git("update-ref", "-d", "refs/remotes/origin/main");
  assert.equal(f.check(["--tag", "v0.3.0"]).status, 1);
});

test("release CLI rejects dirty trees, wrong HEAD, and tags outside main", async (t) => {
  const f = await fixture(t);
  f.git("tag", "-a", "v0.3.0", "-m", "Structor 0.3.0");
  await f.write("untracked.txt", "new file");
  assert.match(f.check(["--tag", "v0.3.0"]).output, /must be clean/);
  f.git("add", "."); f.git("commit", "-m", "later work");
  assert.match(f.check(["--tag", "v0.3.0"]).output, /HEAD must equal/);
  f.git("tag", "-a", "v0.3.1", "-m", "off-main release");
  const result = f.check(["--tag", "v0.3.1"]);
  assert.equal(result.status, 1); assert.match(result.output, /reachable from origin\/main/);
});
