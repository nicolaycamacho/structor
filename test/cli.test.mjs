import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, mkdtemp, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  contributorWorkspacePlan,
  parseArgs,
  renderPopulateContextEvidence,
  renderPopulateReposEvidence,
} from "../bin/structor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin/structor.mjs");

// Fixture construction and diagnostic subprocesses share one bounded Git environment.
// Keep repo-local config visible so the unsafe filter/submodule cases stay meaningful.
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

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "structor-cli-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: fixtureGitEnv,
  });
}

function outputText(result) {
  return `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
}

function runSetupContributor(args = []) {
  return spawnSync(process.execPath, [path.join(repoRoot, "scripts/setup-contributor.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: fixtureGitEnv,
  });
}

function assertSuccess(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

async function createFixtureStructorRepo(root) {
  const fixtureRoot = path.join(root, "fixture-structor");
  await mkdir(path.join(fixtureRoot, "bin"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "contrib/self-harness"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "package.json"), `${JSON.stringify({ name: "@structor-dev/cli", type: "module" })}\n`);
  await writeFile(path.join(fixtureRoot, "bin/structor.mjs"), "#!/usr/bin/env node\n");
  await writeFile(path.join(fixtureRoot, "contrib/self-harness/harness.config.json"), "{}\n");
  await writeFile(path.join(fixtureRoot, "scripts/setup-contributor.mjs"), `
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const selfHarnessRoot = path.resolve(process.cwd(), "..", "structor-self");
await mkdir(path.join(selfHarnessRoot, "scripts"), { recursive: true });
await writeFile(path.join(selfHarnessRoot, "scripts/validate-governance.mjs"), "console.log('fixture validate-governance passed');\\n");
await writeFile(path.join(selfHarnessRoot, "scripts/check-workspace.mjs"), "console.log('fixture check-workspace passed');\\n");
console.log("fixture setup complete");
`);

  for (const args of [
    ["init"],
    ["add", "."],
    ["-c", "user.email=fixture.invalid", "-c", "user.name=Fixture", "commit", "-m", "fixture"],
  ]) {
    const result = spawnSync("git", args, { cwd: fixtureRoot, encoding: "utf8", env: fixtureGitEnv });
    assertSuccess(result, `git ${args.join(" ")}`);
  }

  return fixtureRoot;
}

async function createDoctorWorkspace({ validation = { test: "npm test" }, profile, outputPath = "./demo-structor", durableConfig = false, models = { openai: true, anthropic: false } } = {}) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "structor-doctor-"));
  const consumerRoot = path.join(workspaceRoot, "app");
  const harnessRoot = path.resolve(workspaceRoot, outputPath);
  const configPath = path.join(workspaceRoot, "harness.config.json");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, "package.json"), `${JSON.stringify({ scripts: { test: "node --version" } }, null, 2)}\n`);
  await writeFile(configPath, `${JSON.stringify({
    ...(profile ? { profile } : {}),
    project: {
      name: "Demo",
      slug: "demo",
      harnessRepoName: "demo-structor",
    },
    output: {
      path: outputPath,
    },
    models,
    clientSupport: {
      codex: {
        hooks: false,
      },
      claude: {
        rules: false,
        hooks: false,
        skills: false,
      },
    },
    consumers: [
      {
        name: "app",
        path: "./app",
        purpose: "Application repository",
        validation,
      },
    ],
  }, null, 2)}\n`);

  const generate = spawnSync(process.execPath, [
    path.join(repoRoot, "scripts/init-harness.mjs"),
    "--config", configPath,
    "--install-consumer-entrypoints",
  ], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: fixtureGitEnv,
  });
  assert.equal(generate.status, 0, `generation failed\nstdout:\n${generate.stdout}\nstderr:\n${generate.stderr}`);

  const bootstrap = spawnSync(process.execPath, [path.join(harnessRoot, "scripts/bootstrap-workspace.mjs")], {
    cwd: harnessRoot,
    encoding: "utf8",
    env: fixtureGitEnv,
  });
  assert.equal(bootstrap.status, 0, `workspace bootstrap failed\nstdout:\n${bootstrap.stdout}\nstderr:\n${bootstrap.stderr}`);

  if (durableConfig) {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    await writeFile(path.join(harnessRoot, "harness.config.json"), JSON.stringify({ ...config, workspace: { root: path.relative(harnessRoot, workspaceRoot) } }));
    await rm(configPath);
  }
  return { workspaceRoot, consumerRoot, harnessRoot, configPath };
}

test("parseArgs defaults to the help command", () => {
  assert.equal(parseArgs([]).command, "help");
});

test("parseArgs reads populate flags", () => {
  const { command, options } = parseArgs(["populate", "--workspace", "/ws", "--config", "cfg.json", "--yes", "--dry-run"]);
  assert.equal(command, "populate");
  assert.equal(options.workspace, "/ws");
  assert.equal(options.config, "cfg.json");
  assert.equal(options.yes, true);
  assert.equal(options.dryRun, true);
});

test("parseArgs reads contribute structor flags", () => {
  const { command, options } = parseArgs([
    "contribute",
    "structor",
    "--workspace", "/ws",
    "--repo-url", "/fixtures/structor",
    "--yes",
    "--dry-run",
    "--force",
  ]);
  assert.equal(command, "contribute");
  assert.deepEqual(options._, ["structor"]);
  assert.equal(options.workspace, "/ws");
  assert.equal(options.repoUrl, "/fixtures/structor");
  assert.equal(options.yes, true);
  assert.equal(options.dryRun, true);
  assert.equal(options.force, true);
});

test("parseArgs collects positional args for passthrough", () => {
  const { command, options } = parseArgs(["generate", "extra", "values"]);
  assert.equal(command, "generate");
  assert.deepEqual(options._, ["extra", "values"]);
});

test("doctor rejects unknown flags before running command behavior", () => {
  for (const command of ["doctor"]) {
    const result = runCli([command, "--bogus"]);
    assert.notEqual(result.status, 0, `${command} should reject unknown flags.`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(`Unknown argument for structor ${command}: --bogus`));
  }
});

test("doctor rejects contributor-only flags", () => {
  for (const command of ["doctor"]) {
    for (const flag of ["--dry-run", "--repo-url"]) {
      const result = runCli([command, flag, "fixture"]);
      assert.notEqual(result.status, 0, `${command} should reject ${flag}.`);
      assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(`Unknown argument for structor ${command}: ${flag}`));
    }
  }
});

test("contribute structor rejects unrelated command flags", () => {
  const result = runCli(["contribute", "structor", "--config", "fixture", "--dry-run"]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /Unknown argument for structor contribute: --config/);
});

test("generate still passes generator-specific flags through", () => {
  const result = runCli(["generate", "--dry-run", "--config", "harness.config.example.json"]);
  assert.equal(result.status, 0, `generate passthrough failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /would create/);
});

test("removed init exits without prompting or writing and points to agent setup", async () => {
  await withTempDir(async (root) => {
    const result = spawnSync(process.execPath, [cliPath, "init", "--workspace", root, "--yes"], { cwd: root, encoding: "utf8", env: fixtureGitEnv, timeout: 5_000 });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(outputText(result), /init has been removed/);
    assert.match(outputText(result), /agent.*README/i);
    assert.deepEqual(await readdir(root), []);
  });
});

test("doctor prefers harness-local setup config over a stale workspace config", async () => {
  const { workspaceRoot, harnessRoot, configPath } = await createDoctorWorkspace();
  try {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    await writeFile(path.join(harnessRoot, "harness.config.json"), JSON.stringify({ ...config, workspace: { root: ".." } }));
    await writeFile(configPath, JSON.stringify({ ...config, consumers: [{ name: "missing", path: "./missing", purpose: "Stale config", validation: {} }] }));
    const doctor = runCli(["doctor", "--workspace", workspaceRoot]);
    assertSuccess(doctor, "doctor should use harness-local config");
    assert.match(outputText(doctor), /OK config file exists/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("doctor discovers harness-local setup config in a nested output path", async () => {
  const { workspaceRoot } = await createDoctorWorkspace({ outputPath: "./tools/demo-structor", durableConfig: true });
  try {
    const doctor = runCli(["doctor", "--workspace", workspaceRoot]);
    assertSuccess(doctor, "doctor should discover nested harness-local config");
    assert.match(outputText(doctor), /OK generated harness required files exist/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("doctor reports a healthy generated workspace", async () => {
  const { workspaceRoot } = await createDoctorWorkspace();
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.equal(result.status, 0, `doctor failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(outputText(result), /OK config file exists/);
  assert.match(outputText(result), /OK generated harness required files exist/);
  assert.match(outputText(result), /OK consumer pointer files route to generated harness: app/);
  assert.match(outputText(result), /Target Git:.*relationship=unavailable.*dirty=unavailable/);
});

test("target diagnostics share physical roots and fingerprints without requiring Git or inspecting unrelated paths", async () => {
  const { workspaceRoot, consumerRoot, harnessRoot } = await createDoctorWorkspace();
  try {
    await writeFile(path.join(harnessRoot, "ai/context.md"), "guidance\n");
    await rm(path.join(workspaceRoot, "AGENTS.md"));
    const alias = path.join(workspaceRoot, "selected-checkout");
    await symlink(consumerRoot, alias);
    const before = await snapshotWorkspace(workspaceRoot);
    const doctor = runCli(["doctor", "--workspace", workspaceRoot, "--target", alias, "--json"]);
    assertSuccess(doctor, "scoped Doctor supports non-Git checkouts");
    const report = JSON.parse(doctor.stdout);
    assert.equal(report.target.root, consumerRoot);
    assert.equal(report.harness.root, harnessRoot);
    assert.equal(report.target.git.relationship, "unavailable");
    assert.equal(report.harness.git.relationship, "unavailable");
    assert.equal(report.freshness.live, "unavailable");
    assert.equal(report.freshness.refs, "cached");
    assert.equal(report.guidance.find((file) => file.path === path.join(harnessRoot, "ai/context.md")).sha256,
      "42cfb93dc13506063f18074be5c8f1be6a2006a37adc49b048f8354ef4b86f1f");
    const checker = spawnSync(process.execPath, ["scripts/check-worktrees.mjs", "--target", alias, "--json"], { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv });
    assertSuccess(checker, "scoped generated checker");
    assert.deepEqual(JSON.parse(checker.stdout), report);
    for (const result of runTargetPair({ workspaceRoot, consumerRoot, harnessRoot }, ["--require-git-freshness"])) {
      assert.equal(result.status, 1, outputText(result));
      assert.match(JSON.parse(result.stdout).issues.join("\n"), /Git freshness gate/);
    }
    assert.deepEqual(await snapshotWorkspace(workspaceRoot), before, "diagnosis preserves all workspace files");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("target Git fixtures resist inherited process, global and system configuration", async () => {
  await withTempDir(async (root) => {
    const globalConfig = path.join(root, "global.gitconfig");
    const systemConfig = path.join(root, "system.gitconfig");
    await writeFile(globalConfig, '[filter "global"]\n clean = cat\n[core]\n autocrlf = true\n');
    await writeFile(systemConfig, '[filter "system"]\n clean = cat\n[commit]\n gpgSign = true\n');
    const before = await snapshotWorkspace(root);
    const inheritedEnv = {
      ...process.env,
      GIT_CONFIG_GLOBAL: globalConfig,
      GIT_CONFIG_SYSTEM: systemConfig,
      GIT_CONFIG_NOSYSTEM: "0",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "filter.inherited.clean",
      GIT_CONFIG_VALUE_0: "cat",
      GIT_CONFIG_PARAMETERS: "'filter.parameters.clean=cat'",
    };
    // A nested test runner must not inherit the parent runner's child marker.
    delete inheritedEnv.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--test",
      "--test-reporter=tap",
      "--test-name-pattern=^target (Git evidence|freshness gate classifies|diagnostics never execute|diagnostics avoid recursive|freshness fails closed|inspection reports the selected linked)",
      "test/cli.test.mjs",
    ], { cwd: repoRoot, encoding: "utf8", env: inheritedEnv });
    assertSuccess(result, "ordinary fixtures and intentional safety cases under inherited Git configuration");
    assert.match(result.stdout, /target Git evidence reports revisions/);
    assert.match(result.stdout, /target diagnostics avoid recursive submodule status/);
    assert.ok(Number(result.stdout.match(/# pass (\d+)/)?.[1]) >= 10, "the nested runner must execute all selected provenance cases");
    assert.deepEqual(await snapshotWorkspace(root), before, "inherited config files must remain unchanged");
  });
});

function fixtureGit(root, ...args) {
  const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-C", root, ...args], {
    encoding: "utf8",
    env: fixtureGitEnv,
  });
  assertSuccess(result, `fixture git ${args[0]}`);
  return result.stdout.trim();
}

async function trackFixtureRepo(root, remote) {
  fixtureGit(root, "init", "-b", "main");
  fixtureGit(root, "config", "user.name", "Fixture");
  fixtureGit(root, "config", "user.email", "fixture@example.test");
  fixtureGit(root, "add", ".");
  fixtureGit(root, "commit", "-m", "Initial fixture");
  fixtureGit(path.dirname(root), "init", "--bare", remote);
  fixtureGit(root, "remote", "add", "origin", remote);
  fixtureGit(root, "push", "-u", "origin", "main");
  return fixtureGit(root, "rev-parse", "HEAD");
}

function runTargetPair({ workspaceRoot, consumerRoot, harnessRoot }, flags = []) {
  return [
    runCli(["doctor", "--workspace", workspaceRoot, "--target", consumerRoot, "--json", ...flags]),
    spawnSync(process.execPath, ["scripts/check-worktrees.mjs", "--target", consumerRoot, "--json", ...flags], { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv }),
  ];
}

test("target Git evidence reports revisions, cached upstream equality and clean state without changing Git files", async () => {
  const fixture = await createDoctorWorkspace();
  const { workspaceRoot, consumerRoot, harnessRoot } = fixture;
  try {
    const targetRevision = await trackFixtureRepo(consumerRoot, path.join(workspaceRoot, "app.git"));
    const harnessRevision = await trackFixtureRepo(harnessRoot, path.join(workspaceRoot, "harness.git"));
    const before = await snapshotWorkspace(workspaceRoot);
    for (const result of runTargetPair(fixture, ["--require-git-freshness"])) {
      assertSuccess(result, "clean equal checkouts pass the explicit cached freshness gate");
      const report = JSON.parse(result.stdout);
      for (const [source, revision, root] of [[report.target, targetRevision, consumerRoot], [report.harness, harnessRevision, harnessRoot]]) {
        assert.equal(source.git.root, root);
        assert.equal(source.git.revision, revision);
        assert.equal(source.git.upstreamRevision, revision);
        assert.equal(source.git.branch, "main");
        assert.equal(source.git.upstream, "origin/main");
        assert.equal(source.git.relationship, "equal");
        assert.equal(source.git.ahead, 0);
        assert.equal(source.git.behind, 0);
        assert.equal(source.git.dirty, false);
      }
      assert.equal(report.freshness.ready, true);
      assert.equal(report.freshness.live, "unavailable");
    }
    assert.deepEqual(await snapshotWorkspace(workspaceRoot), before, "diagnosis must preserve Git indexes, refs, logs, config and checkout files");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

for (const source of ["target", "harness"]) {
  test(`target freshness gate classifies cached ${source} history and ignores unrelated auxiliary worktrees`, async () => {
    const fixture = await createDoctorWorkspace();
    const { workspaceRoot, consumerRoot, harnessRoot } = fixture;
    try {
      await trackFixtureRepo(consumerRoot, path.join(workspaceRoot, "app.git"));
      await trackFixtureRepo(harnessRoot, path.join(workspaceRoot, "harness.git"));
      const root = source === "target" ? consumerRoot : harnessRoot;
      const initial = fixtureGit(root, "rev-parse", "HEAD");
      const auxiliary = path.join(workspaceRoot, "unrelated-worktree");
      fixtureGit(consumerRoot, "worktree", "add", "--detach", auxiliary);
      await rm(auxiliary, { recursive: true, force: true });

      async function assertState(relationship, gateStatus, { dirty = false, ahead = null, behind = null } = {}) {
        const before = await snapshotWorkspace(workspaceRoot);
        for (const flags of [[], ["--require-git-freshness"]]) {
          const results = runTargetPair(fixture, flags);
          for (const result of results) {
            assert.equal(result.status, flags.length ? gateStatus : 0, outputText(result));
            const report = JSON.parse(result.stdout);
            assert.equal(report[source].git.relationship, relationship);
            assert.equal(report[source].git.dirty, dirty);
            assert.equal(report[source].git.ahead, ahead);
            assert.equal(report[source].git.behind, behind);
            assert.equal(report.freshness.ready, gateStatus === 0);
            if (gateStatus) assert.match(report.issues.join("\n"), flags.length ? /Git freshness gate/ : /^$/);
          }
          assert.deepEqual(JSON.parse(results[0].stdout), JSON.parse(results[1].stdout));
        }
        assert.deepEqual(await snapshotWorkspace(workspaceRoot), before, "diagnosis cannot fetch, update an index, repair pointers or prune an unrelated worktree");
      }

      await assertState("equal", 0, { ahead: 0, behind: 0 });
      await writeFile(path.join(root, "local-change.txt"), "local\n");
      await assertState("equal", 1, { dirty: true, ahead: 0, behind: 0 });
      fixtureGit(root, "add", ".");
      fixtureGit(root, "commit", "-m", "Local ahead");
      const aheadRevision = fixtureGit(root, "rev-parse", "HEAD");
      await assertState("ahead", 0, { ahead: 1, behind: 0 });

      // The fixture advances the remote without refreshing the inspected checkout.
      const peer = path.join(workspaceRoot, "peer");
      fixtureGit(workspaceRoot, "clone", "--branch", "main", fixtureGit(root, "remote", "get-url", "origin"), peer);
      fixtureGit(peer, "config", "user.name", "Fixture");
      fixtureGit(peer, "config", "user.email", "fixture@example.test");
      await writeFile(path.join(peer, "remote-change.txt"), "remote\n");
      fixtureGit(peer, "add", ".");
      fixtureGit(peer, "commit", "-m", "Remote ahead");
      fixtureGit(peer, "push", "origin", "main");
      await assertState("ahead", 0, { ahead: 1, behind: 0 });
      fixtureGit(root, "fetch", "origin");
      await assertState("diverged", 1, { ahead: 1, behind: 1 });
      fixtureGit(root, "switch", "-c", "behind", initial);
      fixtureGit(root, "branch", "--set-upstream-to=origin/main");
      await assertState("behind", 1, { ahead: 0, behind: 1 });
      fixtureGit(root, "switch", "--detach", aheadRevision);
      await assertState("unavailable", 1);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
}

for (const source of ["target", "harness"]) {
  for (const filter of ["clean", "process"]) {
    test(`target diagnostics never execute configured ${source} ${filter} filters`, async () => {
      const fixture = await createDoctorWorkspace();
      try {
        await trackFixtureRepo(fixture.consumerRoot, path.join(fixture.workspaceRoot, "app.git"));
        await trackFixtureRepo(fixture.harnessRoot, path.join(fixture.workspaceRoot, "harness.git"));
        const root = source === "target" ? fixture.consumerRoot : fixture.harnessRoot;
        await writeFile(path.join(root, ".gitattributes"), "data.txt filter=sideeffect\n");
        await writeFile(path.join(root, "data.txt"), "initial\n");
        fixtureGit(root, "add", ".");
        fixtureGit(root, "commit", "-m", "Filtered fixture file");
        fixtureGit(root, "config", `filter.sideeffect.${filter}`, "echo changed > diagnostic-side-effect.txt; exit 1");
        await writeFile(path.join(root, "data.txt"), "changed\n");
        const before = await snapshotWorkspace(fixture.workspaceRoot);
        for (const flags of [[], ["--require-git-freshness"]]) {
          const results = runTargetPair(fixture, flags);
          assert.deepEqual(JSON.parse(results[0].stdout), JSON.parse(results[1].stdout));
          for (const result of results) {
            assert.equal(result.status, flags.length ? 1 : 0, outputText(result));
            assert.deepEqual(await snapshotWorkspace(fixture.workspaceRoot), before, "diagnostics must never execute checkout filters");
            const git = JSON.parse(result.stdout)[source].git;
            assert.equal(git.dirty, null);
            assert.match(git.dirtyUnavailableReason, /filter/);
            assert.equal(git.relationship, "ahead");
          }
        }
      } finally {
        await rm(fixture.workspaceRoot, { recursive: true, force: true });
      }
    });
  }
}

test("target diagnostics avoid recursive submodule status and report dirty evidence unavailable", async () => {
  const fixture = await createDoctorWorkspace();
  try {
    await trackFixtureRepo(fixture.consumerRoot, path.join(fixture.workspaceRoot, "app.git"));
    await trackFixtureRepo(fixture.harnessRoot, path.join(fixture.workspaceRoot, "harness.git"));
    fixtureGit(fixture.consumerRoot, "-c", "protocol.file.allow=always", "submodule", "add", "-b", "main", path.join(fixture.workspaceRoot, "harness.git"), "nested");
    fixtureGit(fixture.consumerRoot, "commit", "-m", "Submodule fixture");
    const nested = path.join(fixture.consumerRoot, "nested");
    fixtureGit(nested, "config", "filter.sideeffect.clean", "cat; echo changed > diagnostic-side-effect.txt");
    await writeFile(path.join(nested, ".gitattributes"), "README.md filter=sideeffect\n");
    await writeFile(path.join(nested, "README.md"), "changed\n");
    const before = await snapshotWorkspace(fixture.workspaceRoot);
    for (const flags of [[], ["--require-git-freshness"]]) {
      const results = runTargetPair(fixture, flags);
      assert.deepEqual(JSON.parse(results[0].stdout), JSON.parse(results[1].stdout));
      for (const result of results) {
        assert.equal(result.status, flags.length ? 1 : 0, outputText(result));
        assert.deepEqual(await snapshotWorkspace(fixture.workspaceRoot), before);
        const git = JSON.parse(result.stdout).target.git;
        assert.equal(git.dirty, null);
        assert.match(git.dirtyUnavailableReason, /submodule/i);
        assert.equal(git.relationship, "ahead");
      }
    }
  } finally {
    await rm(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("target inspection reports an absent harness as unavailable rather than inventing a physical source root", async () => {
  const fixture = await createDoctorWorkspace();
  try {
    await rm(fixture.harnessRoot, { recursive: true, force: true });
    const result = runCli(["doctor", "--workspace", fixture.workspaceRoot, "--target", fixture.consumerRoot, "--json"]);
    assert.equal(result.status, 1, outputText(result));
    const report = JSON.parse(result.stdout);
    assert.equal(report.harness.root, null);
    assert.deepEqual(report.harness.roots, []);
    assert.match(report.issues.join("\n"), /missing generated-harness file/);
  } finally {
    await rm(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("target freshness fails closed when history is shallow while ordinary inspection still reports available facts", async () => {
  const fixture = await createDoctorWorkspace();
  try {
    await trackFixtureRepo(fixture.consumerRoot, path.join(fixture.workspaceRoot, "app.git"));
    await trackFixtureRepo(fixture.harnessRoot, path.join(fixture.workspaceRoot, "harness.git"));
    const shallowRoot = path.join(fixture.workspaceRoot, "shallow-app");
    fixtureGit(fixture.workspaceRoot, "clone", "--depth", "1", "--branch", "main", `file://${path.join(fixture.workspaceRoot, "app.git")}`, shallowRoot);
    const before = await snapshotWorkspace(fixture.workspaceRoot);
    for (const flags of [[], ["--require-git-freshness"]]) {
      for (const result of runTargetPair({ ...fixture, consumerRoot: shallowRoot }, flags)) {
        assert.equal(result.status, flags.length ? 1 : 0, outputText(result));
        const git = JSON.parse(result.stdout).target.git;
        assert.equal(git.shallow, true);
        assert.equal(git.relationship, "unavailable");
        assert.match(git.unavailableReason, /shallow/);
        assert.match(git.revision, /^[a-f0-9]{40}$/);
        assert.equal(git.dirty, false);
      }
    }
    assert.deepEqual(await snapshotWorkspace(fixture.workspaceRoot), before);
  } finally {
    await rm(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("target diagnostics require a path and keep JSON and freshness options scoped", async () => {
  const fixture = await createDoctorWorkspace();
  try {
    const before = await snapshotWorkspace(fixture.workspaceRoot);
    for (const flags of [["--target"], ["--target", "--json"], ["--require-git-freshness"], ["--json"]]) {
      for (const result of [
        runCli(["doctor", "--workspace", fixture.workspaceRoot, ...flags]),
        spawnSync(process.execPath, ["scripts/check-worktrees.mjs", ...flags], { cwd: fixture.harnessRoot, encoding: "utf8", env: fixtureGitEnv }),
      ]) {
        assert.equal(result.status, 1, outputText(result));
        assert.match(outputText(result), /--target requires|require --target/);
      }
    }
    assert.deepEqual(await snapshotWorkspace(fixture.workspaceRoot), before);
  } finally {
    await rm(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("target inspection reports the selected linked checkout and unavailable upstream without inheriting the canonical branch", async () => {
  const fixture = await createDoctorWorkspace();
  try {
    const revision = await trackFixtureRepo(fixture.consumerRoot, path.join(fixture.workspaceRoot, "app.git"));
    await trackFixtureRepo(fixture.harnessRoot, path.join(fixture.workspaceRoot, "harness.git"));
    const selected = path.join(fixture.workspaceRoot, "feature-app");
    fixtureGit(fixture.consumerRoot, "worktree", "add", "-b", "feature/selected", selected);
    const before = await snapshotWorkspace(fixture.workspaceRoot);
    for (const flags of [[], ["--require-git-freshness"]]) {
      const results = runTargetPair({ ...fixture, consumerRoot: selected }, flags);
      assert.deepEqual(JSON.parse(results[0].stdout), JSON.parse(results[1].stdout));
      for (const result of results) {
        assert.equal(result.status, flags.length ? 1 : 0, outputText(result));
        const report = JSON.parse(result.stdout);
        assert.equal(report.target.root, selected);
        assert.equal(report.target.git.root, selected);
        assert.equal(report.target.git.revision, revision);
        assert.equal(report.target.git.branch, "feature/selected");
        assert.equal(report.target.git.upstream, null);
        assert.equal(report.target.git.relationship, "unavailable");
        assert.equal(report.target.git.dirty, false);
        assert.equal(report.harness.root, fixture.harnessRoot);
        assert.equal(report.harness.git.relationship, "equal");
        assert.equal(report.freshness.ready, false);
        assert.match(report.issues.join("\n"), flags.length ? /Git freshness gate: Target upstream relationship is unavailable/ : /^$/);
      }
    }
    assert.deepEqual(await snapshotWorkspace(fixture.workspaceRoot), before);
  } finally {
    await rm(fixture.workspaceRoot, { recursive: true, force: true });
  }
});

test("doctor names a missing generated file and exits non-zero", async () => {
  const { workspaceRoot, harnessRoot } = await createDoctorWorkspace();
  await rm(path.join(harnessRoot, "AGENTS.md"));
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /FAIL generated harness required file exists - AGENTS\.md/);
});

test("doctor names a missing consumer pointer and exits non-zero", async () => {
  const { workspaceRoot, consumerRoot } = await createDoctorWorkspace();
  await rm(path.join(consumerRoot, "AGENTS.md"));
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /consumer:app:AGENTS\.md missing/);
});

test("doctor names a stale consumer pointer and exits non-zero", async () => {
  const { workspaceRoot, consumerRoot } = await createDoctorWorkspace();
  const pointerPath = path.join(consumerRoot, "AGENTS.md");
  const stalePointer = (await readFile(pointerPath, "utf8")).replaceAll("../demo-structor", "../old/demo-structor");
  await writeFile(pointerPath, stalePointer);
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.notEqual(result.status, 0);
  assert.match(outputText(result), /consumer:app:AGENTS\.md points at .*old\/demo-structor instead of .*demo-structor/);
});

test("Doctor and generated checks reject a pointer target escaping the canonical harness", async () => {
  const { workspaceRoot, consumerRoot, harnessRoot } = await createDoctorWorkspace();
  try {
    assertSuccess(spawnSync("git", ["init"], { cwd: consumerRoot, encoding: "utf8", env: fixtureGitEnv }), "initialize synthetic consumer");
    const outsidePath = path.join(workspaceRoot, "outside.md");
    await writeFile(outsidePath, "# Outside policy\n");
    await symlink(outsidePath, path.join(harnessRoot, "ai/escaped.md"));
    const pointerPath = path.join(consumerRoot, "AGENTS.md");
    const pointer = "Read ../demo-structor/ai/escaped.md before editing.\n";
    await writeFile(pointerPath, pointer);

    const doctor = runCli(["doctor", "--workspace", workspaceRoot]);
    assert.notEqual(doctor.status, 0);
    assert.match(outputText(doctor), /outside the generated harness/);
    const before = await snapshotWorkspace(workspaceRoot);
    for (const result of runTargetPair({ workspaceRoot, consumerRoot, harnessRoot })) {
      assert.equal(result.status, 1, outputText(result));
      const report = JSON.parse(result.stdout);
      assert.match(report.issues.join("\n"), /outside the generated harness/);
      const unsafe = report.guidance.find((file) => file.path.endsWith("/ai/escaped.md"));
      assert.equal(unsafe.status, "unsafe");
      assert.equal(unsafe.sha256, null);
      assert.equal(unsafe.physicalPath, outsidePath);
    }
    assert.deepEqual(await snapshotWorkspace(workspaceRoot), before);
    for (const args of [
      ["scripts/check-workspace.mjs"],
      ["scripts/check-worktrees.mjs", "--include-canonical", "--no-worktree-list"],
      ["scripts/bootstrap-codex-worktree.mjs", consumerRoot, "--dry-run"],
    ]) {
      const result = spawnSync(process.execPath, args, { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv });
      assert.match(outputText(result), /outside the generated harness/, args.join(" "));
      if (!args[0].includes("bootstrap-codex")) assert.notEqual(result.status, 0);
    }
    assert.equal(await readFile(pointerPath, "utf8"), pointer);
    assert.equal(await readFile(outsidePath, "utf8"), "# Outside policy\n");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

async function snapshotWorkspace(root) {
  const entries = [];
  for (const relativePath of (await readdir(root, { recursive: true })).sort()) {
    const target = path.join(root, relativePath);
    const info = await lstat(target);
    const content = info.isSymbolicLink() ? await readlink(target)
      : info.isFile() ? (await readFile(target)).toString("base64") : null;
    entries.push({ relativePath, content, mode: info.mode, mtimeMs: info.mtimeMs });
  }
  return entries;
}

for (const profile of ["focused", "expanded"]) {
  for (const models of [
    { openai: true, anthropic: false },
    { openai: false, anthropic: true },
    { openai: true, anthropic: true },
  ]) {
    test(`routing parity for ${profile}, OpenAI=${models.openai}, Anthropic=${models.anthropic}`, async (t) => {
      const { workspaceRoot, consumerRoot, harnessRoot } = await createDoctorWorkspace({ profile, models });
      try {
        assertSuccess(spawnSync("git", ["init"], { cwd: consumerRoot, encoding: "utf8", env: fixtureGitEnv }), "initialize synthetic consumer");
        const entrypoint = models.openai ? "AGENTS.md" : "CLAUDE.md";
        const pointerPath = path.join(consumerRoot, entrypoint);
        const aliasRoot = path.join(workspaceRoot, "alias", "demo-structor");
        await mkdir(path.dirname(aliasRoot));
        await symlink(harnessRoot, aliasRoot);
        await symlink(path.join(harnessRoot, "ai/context.md"), path.join(harnessRoot, "ai/context-alias.md"));
        const cases = [
          { name: "relative Markdown reference", content: `Read [policy](../demo-structor/${entrypoint}).`, valid: true },
          { name: "absolute repeated reference", content: `Read \`${harnessRoot}/${entrypoint}\` and \`${harnessRoot}/${entrypoint}\`.`, valid: true },
          { name: "canonical root alias", content: `Read ../alias/demo-structor/${entrypoint}.`, valid: true },
          { name: "internal target symlink", content: "Read ../demo-structor/ai/context-alias.md.", valid: true },
          { name: "substring only", content: "This mentions demo-structor without a path.", diagnostic: /does not contain a resolvable/ },
          { name: "lookalike name", content: `Read ../demo-structor-other/${entrypoint}.`, diagnostic: /does not contain a resolvable/ },
          { name: "stale relative", content: `Read ../old/demo-structor/${entrypoint}.`, diagnostic: /instead of/ },
          { name: "wrong absolute root", content: `Read ${workspaceRoot}/other/demo-structor/${entrypoint}.`, diagnostic: /instead of/ },
          { name: "missing target", content: "Read ../demo-structor/ai/MISSING.md.", diagnostic: /references missing generated-harness file ai\/MISSING\.md/ },
          { name: "directory target", content: "Read ../demo-structor/ai.", diagnostic: /references missing generated-harness file ai/ },
          { name: "root without file", content: "Read ../demo-structor.", diagnostic: /references missing generated-harness file \./ },
          { name: "valid and invalid references", content: `Read ../demo-structor/${entrypoint} and ../demo-structor/ai/MISSING.md.`, diagnostic: /references missing generated-harness file ai\/MISSING\.md/ },
          ...(!models.openai ? [{ name: "disabled OpenAI entrypoint", content: "Read ../demo-structor/AGENTS.md.", diagnostic: /OpenAI support is disabled/ }] : []),
          ...(!models.anthropic ? [{ name: "disabled Anthropic entrypoint", content: "Read ../demo-structor/CLAUDE.md.", diagnostic: /Anthropic support is disabled/ }] : []),
        ];
        for (const testCase of cases) {
          await t.test(testCase.name, async () => {
            await writeFile(pointerPath, testCase.content);
            const before = await snapshotWorkspace(workspaceRoot);
            const doctor = runCli(["doctor", "--workspace", workspaceRoot]);
            const scopedDoctor = runCli(["doctor", "--workspace", workspaceRoot, "--target", consumerRoot, "--json"]);
            assert.deepEqual(await snapshotWorkspace(workspaceRoot), before, "Doctor must not write any workspace file");
            const workspace = spawnSync(process.execPath, ["scripts/check-workspace.mjs"], { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv });
            assert.equal(doctor.status === 0, Boolean(testCase.valid), outputText(doctor));
            assert.equal(scopedDoctor.status === 0, Boolean(testCase.valid), outputText(scopedDoctor));
            const targetReport = JSON.parse(scopedDoctor.stdout);
            assert.equal(targetReport.entrypoints.length, Number(models.openai) + Number(models.anthropic));
            assert.equal(workspace.status === 0, Boolean(testCase.valid), outputText(workspace));
            if (!testCase.valid) {
              assert.match(outputText(doctor), testCase.diagnostic);
              assert.match(targetReport.issues.join("\n"), testCase.diagnostic);
              assert.match(outputText(workspace), testCase.diagnostic);
            }
            // Worktree commands are expanded-only surfaces; focused keeps the resolver for workspace checks.
            if (profile === "expanded") {
              const scopedCheck = spawnSync(process.execPath, ["scripts/check-worktrees.mjs", "--target", consumerRoot, "--json"], { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv });
              assert.equal(scopedCheck.status, scopedDoctor.status, outputText(scopedCheck));
              assert.deepEqual(JSON.parse(scopedCheck.stdout), targetReport);
              const check = spawnSync(process.execPath, ["scripts/check-worktrees.mjs", "--include-canonical", "--no-worktree-list"], { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv });
              assert.equal(check.status === 0, Boolean(testCase.valid), outputText(check));
              const bootstrap = spawnSync(process.execPath, ["scripts/bootstrap-codex-worktree.mjs", consumerRoot, "--dry-run"], { cwd: harnessRoot, encoding: "utf8", env: fixtureGitEnv });
              assertSuccess(bootstrap, "read-only worktree bootstrap inspection");
              assert.match(outputText(bootstrap), testCase.valid ? /already valid/ : testCase.diagnostic);
              if (!testCase.valid) assert.match(outputText(check), testCase.diagnostic);
            }
            assert.deepEqual(await snapshotWorkspace(workspaceRoot), before, "validation and dry-run must preserve workspace state");
          });
        }
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    });
  }
}

test("doctor warns for consumers without validation commands but exits zero", async () => {
  const { workspaceRoot } = await createDoctorWorkspace({ validation: {} });
  const result = runCli(["doctor", "--workspace", workspaceRoot]);
  assert.equal(result.status, 0, `doctor failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(outputText(result), /WARN consumer validation command documented: app - no validation commands configured/);
});

test("populate previews deterministic canonical guidance updates before a confirmed write", async () => {
  await withTempDir(async (root) => {
    const { workspaceRoot, consumerRoot, harnessRoot } = await createDoctorWorkspace();
    try {
      await writeFile(
        path.join(consumerRoot, "package.json"),
        `${JSON.stringify({ name: "demo-app", description: "Local demo application", scripts: { test: "node --version" } }, null, 2)}\n`,
      );
      await mkdir(path.join(consumerRoot, ".structor", "preserved-guidance", "2026-07-24T10-00-00"), { recursive: true });
      await writeFile(
        path.join(consumerRoot, ".structor", "preserved-guidance", "2026-07-24T10-00-00", "manifest.json"), "{}\n");

      const contextPath = path.join(harnessRoot, "ai", "context.md");
      const before = await readFile(contextPath, "utf8");
      await writeFile(contextPath, `${before}\nUser-owned note outside the population section.\n`);
      const beforeDryRun = await readFile(contextPath, "utf8");
      const dryRun = runCli(["populate", "--workspace", workspaceRoot, "--dry-run"]);

      assertSuccess(dryRun, "populate dry-run should succeed");
      assert.match(outputText(dryRun), /Dry run only\. No files were written\./);
      assert.match(outputText(dryRun), /will update existing populated section ai\/context\.md/);
      assert.match(outputText(dryRun), /Existing populated sections will be replaced/);
      assert.match(outputText(dryRun), /ai\/context\.md/);
      assert.equal(await readFile(contextPath, "utf8"), beforeDryRun, "dry-run must not modify canonical guidance");

      const write = runCli(["populate", "--workspace", workspaceRoot, "--yes"]);
      assertSuccess(write, "populate --yes should write the previewed guidance");
      assert.match(outputText(write), /Review required: populated files are personalized starter guidance/);
      assert.match(await readFile(contextPath, "utf8"), /demo-app/);
      assert.match(await readFile(contextPath, "utf8"), /Local demo application/);
      assert.match(await readFile(contextPath, "utf8"), /Preserved guidance detected/);
      assert.match(await readFile(contextPath, "utf8"), /User-owned note outside the population section/);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});

test("populate supports the focused first-session journey", async () => {
  const { workspaceRoot, harnessRoot } = await createDoctorWorkspace({ profile: "focused" });
  try {
    assert.equal(existsSync(path.join(harnessRoot, "ai", "workspace", "REPOS.md")), false);
    const result = runCli(["populate", "--workspace", workspaceRoot, "--dry-run"]);

    assertSuccess(result, "focused populate dry-run should succeed");
    assert.match(outputText(result), /ai\/context\.md/);
    assert.doesNotMatch(outputText(result), /ai\/workspace\/REPOS\.md/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("populate evidence renderers preserve consumer data as Markdown data", () => {
  const consumers = [
    {
      config: { name: "app", path: "./app", purpose: "Primary\n## injected", validation: {} },
      packageName: "@demo/app",
      packageDescription: "Application\n## injected",
      validation: ["test: npm test"],
      preservedGuidance: [".structor/preserved-guidance/one"],
    },
    {
      config: { name: "worker", path: "./worker", purpose: "Background worker", validation: {} },
      packageName: null,
      packageDescription: null,
      validation: [],
      preservedGuidance: [],
    },
  ];

  const context = renderPopulateContextEvidence(consumers);
  const repos = renderPopulateReposEvidence(consumers);

  assert.match(context, /`app` at `\.\/app`/);
  assert.match(context, /\\#\\# injected/);
  assert.match(context, /none recorded/);
  assert.match(repos, /`worker`: Background worker/);
  assert.match(repos, /\\#\\# injected/);
});

test("populate refuses non-interactive writes without --yes", async () => {
  const { workspaceRoot } = await createDoctorWorkspace();
  try {
    const result = runCli(["populate", "--workspace", workspaceRoot]);
    assert.notEqual(result.status, 0, "non-interactive populate must require explicit consent");
    assert.match(outputText(result), /requires --yes when stdin is not interactive/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("contributorWorkspacePlan defaults to the current folder workspace", () => {
  const plan = contributorWorkspacePlan({}, "/workspace");
  assert.equal(plan.workspaceRoot, "/workspace");
  assert.equal(plan.sourceRoot, "/workspace/structor");
  assert.equal(plan.selfHarnessRoot, "/workspace/structor-self");
});

test("help lists the supported commands without the removed wizard", () => {
  const result = runCli(["help"]);
  assertSuccess(result, "structor help");
  assert.doesNotMatch(result.stdout, /structor init/);
  assert.match(result.stdout, /agent <plan\|hash\|apply>/);
  assert.match(result.stdout, /structor generate/);
  assert.match(result.stdout, /structor doctor/);
  assert.match(result.stdout, /structor populate/);
  assert.match(result.stdout, /contribute structor/);
});

test("cli runs when invoked through an local bin symlink", async () => {
  await withTempDir(async (root) => {
    const linkedCliPath = path.join(root, "structor");
    await symlink(cliPath, linkedCliPath);

    const result = spawnSync(linkedCliPath, ["--help"], {
      cwd: repoRoot,
      encoding: "utf8",
    env: fixtureGitEnv,
    });

    assertSuccess(result, "structor symlink help");
    assert.match(result.stdout, /Structor/);
    assert.match(result.stdout, /structor agent/);
  });
});

test("contribute structor dry-run previews without writing", async () => {
  await withTempDir(async (root) => {
    const workspaceRoot = path.join(root, "preview");
    const result = runCli(["contribute", "structor", "--dry-run", "--workspace", workspaceRoot]);
    assertSuccess(result, "contribute structor dry-run");
    assert.match(result.stdout, /Contributor workspace preview/);
    assert.match(result.stdout, /Network reads/);
    assert.match(result.stdout, /Local filesystem writes/);
    assert.match(result.stdout, /Validation/);
    assert.equal(existsSync(workspaceRoot), false);
  });
});

test("contribute structor reuses an existing source checkout", async () => {
  await withTempDir(async (root) => {
    const sourceRoot = path.join(root, "workspace/structor");
    await mkdir(path.join(sourceRoot, "bin"), { recursive: true });
    await mkdir(path.join(sourceRoot, "scripts"), { recursive: true });
    await mkdir(path.join(sourceRoot, "contrib/self-harness"), { recursive: true });
    await writeFile(path.join(sourceRoot, "package.json"), `${JSON.stringify({ name: "@structor-dev/cli" })}\n`);
    await writeFile(path.join(sourceRoot, "bin/structor.mjs"), "");
    await writeFile(path.join(sourceRoot, "scripts/setup-contributor.mjs"), "");
    await writeFile(path.join(sourceRoot, "contrib/self-harness/harness.config.json"), "{}\n");

    const result = runCli(["contribute", "structor", "--dry-run", "--workspace", path.join(root, "workspace")]);
    assertSuccess(result, "contribute structor reuse dry-run");
    assert.match(result.stdout, /reuse existing local checkout/);
    assert.doesNotMatch(result.stdout, /git clone/);
  });
});

test("setup contributor forwards force to workspace bootstrap preview", () => {
  const result = runSetupContributor(["--dry-run", "--force"]);
  assertSuccess(result, "setup contributor force dry-run");
  assert.match(result.stdout, /bootstrap-workspace\.mjs --force/);
  assert.doesNotMatch(outputText(result), /preservation consent/);
});

test("contribute structor completes from a local fixture repo without GitHub auth", async () => {
  await withTempDir(async (root) => {
    const fixtureRoot = await createFixtureStructorRepo(root);
    const workspaceRoot = path.join(root, "workspace");
    const result = runCli([
      "contribute",
      "structor",
      "--repo-url", fixtureRoot,
      "--workspace", workspaceRoot,
      "--yes",
    ]);

    assertSuccess(result, "contribute structor local fixture");
    assert.match(result.stdout, /Structor contributor workspace ready/);
    assert.match(result.stdout, /Validation: passed/);
    assert.equal(existsSync(path.join(workspaceRoot, "structor/package.json")), true);
    assert.equal(await readFile(path.join(workspaceRoot, "structor-self/scripts/check-workspace.mjs"), "utf8"), "console.log('fixture check-workspace passed');\n");
  });
});
