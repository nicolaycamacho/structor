import { cp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Materializes public source only. It never runs an agent or scores an attempt.
const source = path.dirname(fileURLToPath(import.meta.url));
const destination = process.argv[2];
if (!destination) throw new Error("Usage: node prepare.mjs <new-workspace>");
const root = path.resolve(destination);
await mkdir(root); // Refuse an existing workspace rather than overwrite it.
for (const name of ["example-frontend", "example-api"]) {
  const cwd = path.join(root, name);
  await cp(path.join(source, "seed", name), cwd, { recursive: true });
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Synthetic Fixture",
    GIT_AUTHOR_EMAIL: "fixture",
    GIT_COMMITTER_NAME: "Synthetic Fixture",
    GIT_COMMITTER_EMAIL: "fixture",
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
  };
  const git = (...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  git("init", "-q", "--initial-branch=main");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "Synthetic starting state");
  console.log(`${name} ${git("rev-parse", "HEAD")}`);
}
await cp(path.join(source, "comparison.config.json"), path.join(root, "comparison.config.json"));
