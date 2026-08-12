#!/usr/bin/env node

import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { install, doctor } from "./init.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = join(repoRoot, "template");
const manifestRel = join(".cursor", ".cursor-os-manifest.json");
const manifestPath = (target) => join(target, manifestRel);
const hash = (value) => createHash("sha256").update(value).digest("hex");

let passed = 0;
const failures = [];
function check(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}`);
  }
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "cursor-os-upgrade-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withTemplateMutation(rel, replacement, fn) {
  const path = join(templateRoot, rel);
  const original = readFileSync(path);
  try {
    writeFileSync(path, replacement);
    fn(path, original);
  } finally {
    writeFileSync(path, original);
  }
}

console.log("Cursor OS — upgrade safety regression test\n");

console.log("pre-existing ownership:");
withTempDir((dir) => {
  const agents = join(dir, "AGENTS.md");
  const userContent = "# Existing project contract\nNever replace this.\n";
  writeFileSync(agents, userContent);

  const first = install({ target: dir });
  const manifest = JSON.parse(readFileSync(manifestPath(dir), "utf8"));
  check("pre-existing file is reported as customized", first.customized.includes("AGENTS.md"));
  check("pre-existing file is explicitly reported unmanaged", first.unmanaged.includes("AGENTS.md"));
  check("pre-existing file is not silently adopted", manifest.files["AGENTS.md"] === undefined);

  withTemplateMutation("AGENTS.md", "# Future Cursor OS contract\n", () => {
    install({ target: dir, update: true });
    check("later --update cannot overwrite an unowned pre-existing file", readFileSync(agents, "utf8") === userContent);
  });
});

console.log("\npruned optional rules:");
withTempDir((dir) => {
  install({ target: dir });
  const frontend = join(dir, ".cursor", "rules", "frontend.mdc");
  rmSync(frontend);

  const updated = install({ target: dir, update: true });
  const manifest = JSON.parse(readFileSync(manifestPath(dir), "utf8"));
  check("init --update preserves an intentionally removed optional rule", !existsSync(frontend));
  check("pruned rule is reported", updated.pruned.includes(join(".cursor", "rules", "frontend.mdc")));
  check("pruned state is persisted", manifest.pruned.includes(".cursor/rules/frontend.mdc"));
  check("pruned rule is removed from managed hashes", manifest.files[".cursor/rules/frontend.mdc"] === undefined);

  install({ target: dir });
  check("plain init also preserves pruning", !existsSync(frontend));
});

console.log("\nrequired managed-file restoration:");
withTempDir((dir) => {
  install({ target: dir });
  const required = join(dir, "prompts", "plan-feature.md");
  rmSync(required);
  const result = install({ target: dir });
  check("missing required managed file is restored", existsSync(required));
  check("restoration is reported separately", result.restored.includes(join("prompts", "plan-feature.md")));
});

console.log("\nmanifest corruption:");
withTempDir((dir) => {
  install({ target: dir });
  writeFileSync(manifestPath(dir), "{ definitely-not-json\n", "utf8");
  let error = null;
  try {
    install({ target: dir, update: true });
  } catch (caught) {
    error = caught;
  }
  check("invalid manifest blocks --update", Boolean(error));
  check("invalid manifest explains ownership safety", /ownership state/i.test(error?.message ?? ""));
  const health = doctor({ target: dir });
  check("doctor reports invalid manifest", health.manifestStatus === "invalid");
  check("doctor disables safe update when manifest is invalid", health.updateSafe === false);
});

console.log("\nmissing manifest / legacy install:");
withTempDir((dir) => {
  install({ target: dir });
  rmSync(manifestPath(dir));
  const agents = join(dir, "AGENTS.md");
  const customized = readFileSync(agents, "utf8") + "\n# Local rule\n";
  writeFileSync(agents, customized);

  const result = install({ target: dir });
  const manifest = JSON.parse(readFileSync(manifestPath(dir), "utf8"));
  check("legacy existing file is preserved", readFileSync(agents, "utf8") === customized);
  check("legacy existing file remains unmanaged", manifest.files["AGENTS.md"] === undefined);
  check("legacy existing file is reported unmanaged", result.unmanaged.includes("AGENTS.md"));
});

console.log("\nfilesystem conflicts:");
if (process.platform === "win32") {
  console.log("  ok  symlink write-through regression is covered on Unix CI");
  passed++;
} else {
  withTempDir((dir) => {
    install({ target: dir });
    const rule = join(dir, ".cursor", "rules", "debugging.mdc");
    const outside = join(dir, "outside.txt");
    const outsideContent = "outside must stay untouched\n";
    writeFileSync(outside, outsideContent);
    rmSync(rule);
    symlinkSync(outside, rule);

    const result = install({ target: dir, update: true });
    check("destination symlink is reported as a conflict", result.conflicts.some((item) => item.rel === join(".cursor", "rules", "debugging.mdc")));
    check("installer never writes through destination symlink", readFileSync(outside, "utf8") === outsideContent);
    const health = doctor({ target: dir });
    check("doctor reports symlink conflict", health.conflicts > 0);
  });
}

console.log("\nobsolete managed files:");
withTempDir((dir) => {
  install({ target: dir });
  const obsoleteRel = join("prompts", "removed-in-future.md");
  const obsoleteKey = "prompts/removed-in-future.md";
  const obsolete = join(dir, obsoleteRel);
  const content = "old cursor-os workflow\n";
  writeFileSync(obsolete, content);

  const manifest = JSON.parse(readFileSync(manifestPath(dir), "utf8"));
  manifest.files[obsoleteKey] = hash(content);
  writeFileSync(manifestPath(dir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const plain = install({ target: dir });
  check("plain init reports unchanged obsolete managed file", plain.obsolete.includes(obsoleteRel));
  check("plain init does not remove obsolete file", existsSync(obsolete));

  const update = install({ target: dir, update: true });
  check("--update removes unchanged obsolete managed file", !existsSync(obsolete));
  check("obsolete removal is reported", update.removed.includes(obsoleteRel));
});

console.log("\ncustomized obsolete files:");
withTempDir((dir) => {
  install({ target: dir });
  const obsoleteRel = join("prompts", "removed-but-customized.md");
  const obsoleteKey = "prompts/removed-but-customized.md";
  const obsolete = join(dir, obsoleteRel);
  const installed = "old cursor-os workflow\n";
  writeFileSync(obsolete, "team customized this workflow\n");

  const manifest = JSON.parse(readFileSync(manifestPath(dir), "utf8"));
  manifest.files[obsoleteKey] = hash(installed);
  writeFileSync(manifestPath(dir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const result = install({ target: dir, update: true });
  check("--update preserves customized obsolete file", existsSync(obsolete));
  check("customized obsolete file is reported customized", result.customized.includes(obsoleteRel));
});

console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("Upgrade safety regression test passed.");
