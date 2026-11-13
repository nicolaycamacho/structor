import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
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
    for (const level of levels.slice(0, 5)) {
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


test("C5 explicitly blocks a claim without bounded evidence and a change baseline", async () => {
  await withHarness({}, async (harnessRoot) => {
    const manifestPath = path.join(harnessRoot, "ai/contracts/api-boundary.contract.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.maturity.level = "C5 Governed";
    await writeFile(manifestPath, JSON.stringify(manifest));
    const result = checkContracts(harnessRoot);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /api-boundary.*evidence/);
    assert.match(result.stderr, /baseline/);
  });
});

const digest = (content) => createHash("sha256").update(content).digest("hex");
function canonicalEvidence(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalEvidence).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalEvidence(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function evidenceFixture(harnessRoot, level = "C4 Validated") {
  const manifestPath = path.join(harnessRoot, "ai/contracts/api-boundary.contract.json");
  const docPath = path.join(harnessRoot, "ai/contracts/api-boundary.md");
  const sourcePath = path.join(path.dirname(harnessRoot), "example-app/boundary.json");
  await writeFile(sourcePath, '{"input":"widget"}\n');
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const source = { repo: "example-app", path: "boundary.json", sha256: digest(await readFile(sourcePath)) };
  if (level === "C5 Governed") {
    const marker = digest(canonicalEvidence([source]));
    await writeFile(docPath, `${await readFile(docPath, "utf8")}\n<!-- structor:contract-sources-sha256 ${marker} -->\n`);
  }
  const documentationSha256 = digest(await readFile(docPath));
  manifest.maturity = {
    level, scope: "Synthetic widget input declaration", limitations: ["No behavior or prose correctness checked"],
    evidence: {
      sources: [source], documentationSha256,
      check: "Review the synthetic input declaration against the sibling map",
      observation: "The fixture input is declared as widget", result: "pass",
      limitations: ["Recorded manual observation only; runtime behavior is unobserved"],
    },
  };
  if (level === "C5 Governed") manifest.maturity.governance = {
    surfaces: [{ repo: source.repo, path: source.path }],
    baseline: {
      sources: [{ ...source }], documentationSha256,
      evidenceSha256: digest(canonicalEvidence(manifest.maturity.evidence)),
    },
  };
  const save = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await save();
  return { manifest, sourcePath, docPath, save };
}

test("C4 accepts current bounded evidence and reports missing/stale evidence without blocking", async () => {
  await withHarness({}, async (harnessRoot) => {
    const { manifest, sourcePath, save } = await evidenceFixture(harnessRoot);
    assert.deepEqual(shapeErrors(manifest), []);
    let result = checkContracts(harnessRoot);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    await writeFile(sourcePath, '{"input":"changed"}\n');
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /Advisory:.*evidence source.*stale.*rerun/);
    await rm(sourcePath);
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /source.*unavailable.*restore/);
    delete manifest.maturity.evidence;
    await save();
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /evidence.*record/);

  });
});

test("C5 unchanged surfaces pass; changed surfaces require matching evidence and documentation refresh", async () => {
  await withHarness({}, async (harnessRoot) => {
    const { manifest, sourcePath, docPath, save } = await evidenceFixture(harnessRoot, "C5 Governed");
    assert.deepEqual(shapeErrors(manifest), []);
    let result = checkContracts(harnessRoot);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const governance = spawnSync(process.execPath, ["scripts/validate-governance.mjs"], { cwd: harnessRoot, encoding: "utf8" });
    assert.equal(governance.status, 0, governance.stdout + governance.stderr);
    await writeFile(sourcePath, '{"input":"changed"}\n');
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /governed surface.*requires matching current evidence/);
    assert.match(result.stderr, /changed without documentation updates/);
    assert.match(result.stderr, /changed without evidence updates/);
    manifest.maturity.evidence.sources[0].sha256 = digest(await readFile(sourcePath));
    manifest.maturity.evidence.observation = "The fixture now declares changed input";
    await save();
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /changed without documentation updates/);
    await writeFile(docPath, "# Synthetic declaration\nThe input declaration is now changed.\n");
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /documentationSha256 is stale/);
    const marker = digest(canonicalEvidence(manifest.maturity.evidence.sources));
    await writeFile(docPath, `${await readFile(docPath, "utf8")}<!-- structor:contract-sources-sha256 ${marker} -->\n`);
    manifest.maturity.evidence.documentationSha256 = digest(await readFile(docPath));
    await save();
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    // Keep the old checkpoint: refreshed evidence/docs satisfy its change policy.
    assert.notEqual(manifest.maturity.evidence.sources[0].sha256, manifest.maturity.governance.baseline.sources[0].sha256);
  });
});

test("C5 fails closed for incomplete/scope-mismatched baselines, sources and evidence records", async () => {
  await withHarness({}, async (harnessRoot) => {
    const { manifest, sourcePath, save } = await evidenceFixture(harnessRoot, "C5 Governed");
    const original = structuredClone(manifest.maturity);
    const cases = [
      [(m) => { delete m.governance.baseline; }, /baseline/],
      [(m) => { m.governance.baseline.sources = []; }, /baseline.sources.*at least one/],
      [(m) => { delete m.governance.baseline.sources[0].sha256; }, /baseline.sources.*sha256/],
      [(m) => { m.governance.baseline.sources[0].path = "other.json"; }, /baseline is stale/],
      [(m) => { m.governance.surfaces = []; }, /surfaces.*at least one/],
      [(m) => { m.evidence.sources = []; }, /evidence.sources.*at least one/],
      [(m) => { m.evidence.sources[0].sha256 = "bad"; }, /sha256/],
      [(m) => { m.evidence.sources.push({ ...m.evidence.sources[0] }); }, /duplicate source/],
      [(m) => { m.evidence.result = "fail"; }, /evidence.result/],
      [(m) => { m.evidence.check = " "; }, /evidence.check/],
      [(m) => { m.evidence.observation = ""; }, /evidence.observation/],
      [(m) => { m.evidence.limitations = []; }, /evidence.limitations/],
      [(m) => { delete m.evidence; }, /evidence/],
      [(m) => { m.evidence.sources[0].repo = "not-configured"; }, /unknown repo/],
      [(m) => { m.evidence.sources[0].path = "../example-app/boundary.json"; }, /without traversal/],
      [(m) => { m.evidence.sources[0].path = "/boundary.json"; }, /repository-relative/],
      [(m) => { m.evidence.sources[0].path = "*.json"; }, /without traversal/],
      [(m) => { m.evidence.sources[0].path = ".git/config"; }, /without traversal/],
      [(m) => { m.governance.surfaces[0].path = "missing.json"; }, /governed surface.*unavailable/],
    ];
    for (const [mutate, expected] of cases) {
      manifest.maturity = structuredClone(original);
      mutate(manifest.maturity);
      await save();
      const result = checkContracts(harnessRoot);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, expected);
    }
    manifest.maturity = structuredClone(original);
    await save();
    await rm(sourcePath);
    let result = checkContracts(harnessRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source.*unavailable/);
    await symlink(path.join(harnessRoot, "ai/contracts/api-boundary.md"), sourcePath);
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /inside its declared repository/);
  });
});


test("documentation-only C5 updates cannot conceal stale evidence and checks never execute manifest methods", async () => {
  await withHarness({}, async (harnessRoot) => {
    const { manifest, sourcePath, docPath, save } = await evidenceFixture(harnessRoot, "C5 Governed");
    const marker = path.join(harnessRoot, "unexpected-execution");
    manifest.maturity.evidence.check = `node -e 'require("node:fs").writeFileSync(${JSON.stringify(marker)}, "executed")'`;
    manifest.validation = [manifest.maturity.evidence.check];
    await save();
    assert.equal(checkContracts(harnessRoot).status, 0);
    await assert.rejects(readFile(marker), { code: "ENOENT" });
    await writeFile(sourcePath, "changed declaration\n");
    await writeFile(docPath, "# Updated synthetic declaration\n");
    await save();
    const result = checkContracts(harnessRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /evidence source.*stale/);
    assert.match(result.stderr, /documentationSha256 is stale/);
  });
});

test("new evidence metadata has a machine-readable shape while low-maturity evidence gaps stay advisory", async () => {
  await withHarness({}, async (harnessRoot) => {
    const { manifest, save } = await evidenceFixture(harnessRoot);
    const original = structuredClone(manifest.maturity.evidence);
    for (const field of ["sources", "documentationSha256", "check", "observation", "result", "limitations"]) {
      manifest.maturity.evidence = structuredClone(original);
      delete manifest.maturity.evidence[field];
      assert.ok(shapeErrors(manifest).some((error) => error.includes(field)), field);
    }
    for (const level of levels.slice(0, 5)) {
      manifest.maturity.level = level;
      manifest.maturity.evidence = {};
      manifest.maturity.governance = {};
      await save();
      const result = checkContracts(harnessRoot);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stderr, /Advisory:.*evidence/);
      assert.match(result.stderr, /governance is inactive/);
    }
  });
});

test("C5 requires a new documentation update on every consecutive source refresh", async () => {
  await withHarness({}, async (harnessRoot) => {
    const { manifest, sourcePath, docPath, save } = await evidenceFixture(harnessRoot, "C5 Governed");
    // First complete change, still compared with the initial reviewed checkpoint.
    await writeFile(sourcePath, "second declaration\n");
    manifest.maturity.evidence.sources[0].sha256 = digest(await readFile(sourcePath));
    manifest.maturity.evidence.observation = "The second declaration was reviewed";
    const marker = digest(canonicalEvidence(manifest.maturity.evidence.sources));
    await writeFile(docPath, `# Second declaration\n<!-- structor:contract-sources-sha256 ${marker} -->\n`);
    manifest.maturity.evidence.documentationSha256 = digest(await readFile(docPath));
    await save();
    let result = checkContracts(harnessRoot);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    // A second change cannot reuse the first change's documentation update.
    await writeFile(sourcePath, "third declaration\n");
    manifest.maturity.evidence.sources[0].sha256 = digest(await readFile(sourcePath));
    manifest.maturity.evidence.observation = "The third declaration was reviewed";
    await save();
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /documentation.*source fingerprint.*refresh/);
    const refreshedMarker = digest(canonicalEvidence(manifest.maturity.evidence.sources));
    await writeFile(docPath, `# Third declaration\n<!-- structor:contract-sources-sha256 ${refreshedMarker} -->\n`);
    manifest.maturity.evidence.documentationSha256 = digest(await readFile(docPath));
    await save();
    result = checkContracts(harnessRoot);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
});
