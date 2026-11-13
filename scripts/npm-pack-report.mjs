// npm 10/11 emit an array; npm 12 emits an object keyed by package name.
export function parsePackReport(output, expectedPackage) {
  function fail(message) {
    throw new Error(`npm pack --json: ${message} No artifact selected.`);
  }

  let report;
  try {
    report = JSON.parse(output);
  } catch {
    fail("Expected valid JSON on stdout; received empty or malformed output.");
  }

  let packed;
  if (Array.isArray(report)) {
    if (report.length !== 1) fail("Expected exactly one package in the array report.");
    [packed] = report;
  } else if (report !== null && typeof report === "object") {
    const keys = Object.keys(report);
    if (keys.length !== 1 || keys[0] !== expectedPackage.name) {
      fail(`Expected exactly one package keyed by ${expectedPackage.name}.`);
    }
    packed = report[expectedPackage.name];
  } else {
    fail("Expected a single-package array or package-name-keyed object.");
  }

  if (!packed || typeof packed !== "object" || Array.isArray(packed)
      || packed.name !== expectedPackage.name || packed.version !== expectedPackage.version) {
    fail(`Expected package ${expectedPackage.name}@${expectedPackage.version}.`);
  }
  if (typeof packed.filename !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.tgz$/.test(packed.filename)) {
    fail("Expected filename to be a local .tgz basename without directory components.");
  }
  if (!Array.isArray(packed.files) || packed.files.length === 0) {
    fail("Expected a nonempty files inventory.");
  }
  const paths = new Set();
  for (const file of packed.files) {
    const filePath = file?.path;
    if (typeof filePath !== "string" || /[\\\x00-\x1f\x7f]/.test(filePath)
        || filePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
        || paths.has(filePath)) {
      fail("Expected unique, nonempty, package-relative paths in files inventory.");
    }
    paths.add(filePath);
  }
  return packed;
}
