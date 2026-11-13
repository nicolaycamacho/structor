import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { repoRoot, validateJsonSchema } from "../scripts/lib.mjs";

const levels = ["C0 Inventory", "C1 Flow Mapped", "C2 Boundary Mapped", "C3 Contract Mapped", "C4 Validated", "C5 Governed"];
const schema = JSON.parse(await readFile(path.join(repoRoot, "schemas/contract-manifest.schema.json"), "utf8"));
const legacy = {
  id: "synthetic-boundary", name: "Synthetic boundary", version: "1.0.0",
  owners: ["example-harness"], affectedRepos: ["example-app"], requiredFiles: ["ai/contracts/example.md"],
};

function shapeErrors(manifest) {
  const errors = [];
  validateJsonSchema(manifest, schema, "contract", errors);
  return errors;
}

test("contract manifests accept every named maturity level and unassessed legacy manifests", () => {
  assert.deepEqual(shapeErrors(legacy), []);
  for (const level of levels) {
    assert.deepEqual(shapeErrors({ ...legacy, maturity: {
      level, scope: "Synthetic boundary only", limitations: ["No runtime behavior observed"],
    } }), [], level);
  }
});

async function withHarness(overrides, run) {
  const root = await mkdtemp(path.join(tmpdir(), "structor-maturity-"));
  try {
    await mkdir(path.join(root, "example-app"));
    await writeFile(path.join(root, "example-app/README.md"), "# Synthetic consumer\n");
    const configPath = path.join(root, "harness.config.json");
    await writeFile(configPath, JSON.stringify({
      profile: "expanded",
      project: { name: "Synthetic Project", slug: "synthetic-project", harnessRepoName: "example-harness" },
      output: { path: "./example-harness" },
      models: { openai: true, anthropic: false },
      clientSupport: { codex: { hooks: false } },
      consumers: [{ name: "example-app", path: "./example-app", purpose: "Synthetic consumer", validation: {} }],
      ...overrides,
    }));
    const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/structor.mjs"), "generate", "--config", configPath], {
      cwd: root, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    await run(path.join(root, "example-harness"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function checkContracts(harnessRoot) {
  return spawnSync(process.execPath, ["scripts/check-contract-manifests.mjs"], { cwd: harnessRoot, encoding: "utf8" });
}

test("generated contract checks reject malformed maturity with field diagnostics and preserve legacy contracts", async () => {
  await withHarness({}, async (harnessRoot) => {
    const manifestPath = path.join(harnessRoot, "ai/contracts/api-boundary.contract.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.maturity;
    await writeFile(manifestPath, JSON.stringify(manifest));
    assert.equal(checkContracts(harnessRoot).status, 0, "legacy contract remains valid");
    const valid = { level: "C0 Inventory", scope: "Synthetic endpoint", limitations: [] };
    const malformed = [
      null, [], "C0 Inventory", {},
      { ...valid, level: "C0" }, { ...valid, level: 4 }, { ...valid, level: "C6 Certified" },
      { ...valid, scope: "  " }, { ...valid, scope: 1 },
      { ...valid, limitations: "unknown" }, { ...valid, limitations: [""] },
      { ...valid, limitations: [null] }, { ...valid, confidence: "high" },
      { level: valid.level, scope: valid.scope },
    ];
    for (const maturity of malformed) {
      assert.ok(shapeErrors({ ...legacy, maturity }).length > 0, JSON.stringify(maturity));
      await writeFile(manifestPath, JSON.stringify({ ...manifest, maturity }));
      const result = checkContracts(harnessRoot);
      assert.equal(result.status, 1, JSON.stringify(maturity));
      assert.match(result.stderr, /api-boundary\.contract\.json.*maturity/);
    }
    for (const level of levels) {
      await writeFile(manifestPath, JSON.stringify({ ...manifest, maturity: { ...valid, level } }));
      const result = checkContracts(harnessRoot);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /maturity claims.*not verified/i);
    }
  });
});

const boundaryExamples = [
  ["HTTP", "GET /widgets"], ["CLI", "widget inspect"], ["Modules/packages", "widget-store.read"],
  ["Events", "widget.updated"], ["Database/state", "widgets table"], ["File formats", "widget-export.json"],
  ["Auth/session", "session cookie"], ["Process boundaries", "worker stdin/stdout"],
];

for (const profile of ["focused", "expanded"]) {
  for (const client of ["openai", "openai-hooks", "anthropic", "both"]) {
    test(`maturity guidance and starter claims respect ${profile}/${client} gates`, async () => {
      const models = { openai: client !== "anthropic", anthropic: ["anthropic", "both"].includes(client) };
      await withHarness({ profile, models, clientSupport: {
        codex: { hooks: client === "openai-hooks" }, claude: { rules: false },
      } }, async (harnessRoot) => {
        if (profile === "focused") {
          await assert.rejects(readFile(path.join(harnessRoot, "ai/contracts/README.md")), { code: "ENOENT" });
          return;
        }
        const readme = await readFile(path.join(harnessRoot, "ai/contracts/README.md"), "utf8");
        for (const level of levels) assert.ok(readme.includes(level), level);
        for (const [kind, subject] of boundaryExamples) {
          assert.ok(readme.includes(kind), kind);
          assert.ok(readme.includes(subject), subject);
        }
        assert.match(readme, /unassessed.*not C0/i);
        assert.match(readme, /structural validity/i);
        assert.match(readme, /verified knowledge/i);
        assert.match(readme, /installation\/adoption/i);
        assert.match(readme, /observed effectiveness/i);
        const contractDir = path.join(harnessRoot, "ai/contracts");
        for (const file of (await readdir(contractDir)).filter((name) => name.endsWith(".contract.json"))) {
          const manifest = JSON.parse(await readFile(path.join(contractDir, file), "utf8"));
          assert.equal(manifest.maturity.level, "C0 Inventory", file);
          assert.ok(manifest.maturity.limitations.length > 0, file);
          assert.deepEqual(shapeErrors(manifest), [], file);
          const doc = await readFile(path.join(contractDir, file.replace(".contract.json", ".md")), "utf8");
          assert.match(doc, /maturity.*manifest/i);
        }
        const hookContract = path.join(contractDir, "codex-hooks.contract.json");
        if (client === "openai-hooks") await readFile(hookContract);
        else await assert.rejects(readFile(hookContract), { code: "ENOENT" });
        const review = await readFile(path.join(harnessRoot, "ai/skills/review-contract-drift.md"), "utf8");
        assert.match(review, /maturity/i);
        assert.match(review, /ai\/contracts\/README\.md/);
        const governance = spawnSync(process.execPath, ["scripts/validate-governance.mjs"], { cwd: harnessRoot, encoding: "utf8" });
        assert.equal(governance.status, 0, governance.stdout + governance.stderr);
      });
    });
  }
}

test("representative cross-boundary inventories use the same metadata without requiring complete maps", async () => {
  await withHarness({}, async (harnessRoot) => {
    const contractDir = path.join(harnessRoot, "ai/contracts");
    const manifestPath = path.join(contractDir, "api-boundary.contract.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const [kind, subject] of boundaryExamples) {
      await writeFile(manifestPath, JSON.stringify({ ...manifest, maturity: {
        level: "C0 Inventory", scope: `${kind}: ${subject}`, limitations: ["Participants and behavior not mapped"],
      } }));
      const result = checkContracts(harnessRoot);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  });
});

test("regeneration preserves existing legacy and reviewed maturity without an explicit overwrite", async () => {
  await withHarness({}, async (harnessRoot) => {
    const manifestPath = path.join(harnessRoot, "ai/contracts/api-boundary.contract.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.maturity;
    for (const saved of [manifest, { ...manifest, maturity: {
      level: "C2 Boundary Mapped", scope: "Reviewed synthetic boundary", limitations: ["Behavior not mapped"],
    } }]) {
      const before = JSON.stringify(saved, null, 2) + "\n";
      await writeFile(manifestPath, before);
      const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/structor.mjs"), "generate", "--config", path.join(path.dirname(harnessRoot), "harness.config.json")], {
        cwd: harnessRoot, encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(await readFile(manifestPath, "utf8"), before);
    }
  });
});
