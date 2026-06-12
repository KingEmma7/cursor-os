#!/usr/bin/env node
// Smoke test for the Cursor OS installer.
// Verifies: files are copied into a scratch dir, --dry-run writes nothing,
// existing user files are never overwritten, the version marker is refreshed,
// doctor passes on an installed dir, and doctor reports missing files otherwise.
// Node built-ins only.

import { install, doctor } from "./init.mjs";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./init.mjs", import.meta.url));
const repoRoot = join(dirname(scriptPath), "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

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

function listAll(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      for (const child of listAll(full)) out.push(join(entry, child));
    } else {
      out.push(entry);
    }
  }
  return out;
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "cursor-os-smoke-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
  });
}

const EXPECTED = [
  "AGENTS.md",
  join(".cursor", "rules", "core.mdc"),
  join(".cursor", "rules", "frontend.mdc"),
  join(".cursor", "rules", "debugging.mdc"),
  join(".cursor", "skills", "implementation-loop", "SKILL.md"),
  join(".cursor", "skills", "debugging-loop", "SKILL.md"),
  join(".cursor", "agents", "verifier.md"),
  join("docs", "repo-memory.md"),
  join("docs", "quality-rubric.md"),
  join("docs", "decision-log.md"),
  join("prompts", "README.md"),
  join("prompts", "localize-cursor-os.md"),
  join("prompts", "plan-feature.md"),
  join("prompts", "implement-change.md"),
  join("prompts", "debug-regression.md"),
  join("prompts", "review-pr.md"),
  join("prompts", "verify-work.md"),
  join("prompts", "update-repo-memory.md"),
];

console.log("Cursor OS — installer smoke test\n");

// 1. Fresh install creates all expected files + the version marker.
console.log("install into an empty dir:");
withTempDir((dir) => {
  const result = install({ target: dir });
  for (const rel of EXPECTED) {
    check(`creates ${rel}`, existsSync(join(dir, rel)));
  }
  check(
    "creates .cursor/.cursor-os-version marker",
    existsSync(join(dir, ".cursor", ".cursor-os-version")),
  );
  check(
    "marker contains version string",
    /cursor-os \d+\.\d+\.\d+/.test(
      existsSync(join(dir, ".cursor", ".cursor-os-version"))
        ? readFileSync(join(dir, ".cursor", ".cursor-os-version"), "utf8")
        : "",
    ),
  );
  check("reports created files", result.created.length >= EXPECTED.length);
  check("reports no refreshed files on a clean install", result.updated.length === 0);
  check("reports nothing skipped on a clean install", result.skipped.length === 0);
});

// 2. --dry-run writes nothing.
console.log("\ndry run:");
withTempDir((dir) => {
  const result = install({ target: dir, dryRun: true });
  check("dry run reports files it would create", result.created.length > 0);
  check("dry run reports no refreshed files in an empty dir", result.updated.length === 0);
  check("dry run writes zero files to disk", listAll(dir).length === 0);
});

// 2b. --dry-run reports marker refresh but does not rewrite the marker.
console.log("\ndry run / existing marker:");
withTempDir((dir) => {
  const markerPath = join(dir, ".cursor", ".cursor-os-version");
  mkdirSync(dirname(markerPath), { recursive: true });
  const sentinel = "cursor-os 0.0.0-test\n";
  writeFileSync(markerPath, sentinel, "utf8");

  const result = install({ target: dir, dryRun: true });
  check(
    "dry run reports existing marker would refresh",
    result.updated.length === 1 && result.updated[0] === join(".cursor", ".cursor-os-version"),
  );
  check(
    "dry run preserves existing marker byte-for-byte",
    readFileSync(markerPath, "utf8") === sentinel,
  );
});

// 3. Existing files are never overwritten.
console.log("\nidempotency / no clobber:");
withTempDir((dir) => {
  const agentsPath = join(dir, "AGENTS.md");
  const sentinel = "# my localized agents file — DO NOT TOUCH\n";
  writeFileSync(agentsPath, sentinel, "utf8");

  const result = install({ target: dir });
  check(
    "preserves a pre-existing AGENTS.md byte-for-byte",
    readFileSync(agentsPath, "utf8") === sentinel,
  );
  check("reports the pre-existing file as skipped", result.skipped.includes("AGENTS.md"));
  check("still creates the other files", existsSync(join(dir, "docs", "repo-memory.md")));

  // Re-running is a no-op: everything already present is skipped.
  const second = install({ target: dir });
  check("second run creates nothing new", second.created.length === 0);
  check(
    "second run refreshes only the version marker",
    second.updated.length === 1 && second.updated[0] === join(".cursor", ".cursor-os-version"),
  );
  check(
    "second run skips every template file",
    second.skipped.length === EXPECTED.length,
  );
});

// 4. A user-modified nested file is preserved while siblings are added.
console.log("\nnested no-clobber:");
withTempDir((dir) => {
  const rulePath = join(dir, ".cursor", "rules", "core.mdc");
  mkdirSync(dirname(rulePath), { recursive: true });
  const custom = "---\nalwaysApply: true\n---\nmy custom core rule\n";
  writeFileSync(rulePath, custom, "utf8");

  install({ target: dir });
  check("preserves a customized nested rule", readFileSync(rulePath, "utf8") === custom);
  check(
    "adds sibling rules that were missing",
    existsSync(join(dir, ".cursor", "rules", "frontend.mdc")),
  );
});

// 5. doctor — passes on a freshly installed directory.
console.log("\ndoctor (installed dir):");
withTempDir((dir) => {
  install({ target: dir });
  const result = doctor({ target: dir });
  check("doctor reports all checks present", result.checks.every((c) => c.present));
  check("doctor checks every installed template file plus marker", result.checks.length === EXPECTED.length + 1);
  for (const rel of [...EXPECTED, join(".cursor", ".cursor-os-version")]) {
    check(`doctor checks ${rel}`, result.checks.some((c) => c.label === rel));
  }
  // Base template has TODO placeholders by design (filled during localization),
  // so todoCount > 0 is expected on a fresh install. The TODO detection test
  // below verifies the detection works correctly.
  check("doctor returns a todoCount number", typeof result.todoCount === "number");
});

// 6. doctor — reports missing files on an empty directory.
console.log("\ndoctor (empty dir):");
withTempDir((dir) => {
  const result = doctor({ target: dir });
  const missingCount = result.checks.filter((c) => !c.present).length;
  check("doctor detects every expected file missing in an empty dir", missingCount === EXPECTED.length + 1);
  for (const rel of [...EXPECTED, join(".cursor", ".cursor-os-version")]) {
    check(`${rel} reported missing`, result.checks.find((c) => c.label === rel)?.present === false);
  }
});

// 7. doctor — fails when any installed template file is missing.
console.log("\ndoctor (partial install):");
withTempDir((dir) => {
  install({ target: dir });
  rmSync(join(dir, "prompts", "plan-feature.md"));
  const result = doctor({ target: dir });
  check(
    "doctor detects a missing non-core template file",
    result.checks.find((c) => c.label === join("prompts", "plan-feature.md"))?.present === false,
  );
});

// 8. doctor — flags TODO placeholders in key files.
console.log("\ndoctor (TODO detection):");
withTempDir((dir) => {
  install({ target: dir });
  // The base AGENTS.md has TODO placeholders in project-context — verify detection.
  const result = doctor({ target: dir });
  const agentsCheck = result.checks.find((c) => c.label === "AGENTS.md");
  check(
    "doctor flags TODO placeholders in AGENTS.md on a non-localized install",
    agentsCheck?.present && agentsCheck?.note !== null,
  );
  check("doctor reports actual TODO placeholder count", result.todoCount > 0);
});

// 8b. doctor — a fully localized install reaches the success state.
console.log("\ndoctor (localized install):");
withTempDir((dir) => {
  install({ target: dir });
  // Simulate localization: real content, no placeholder markers left.
  writeFileSync(
    join(dir, "AGENTS.md"),
    [
      "# AGENTS.md",
      "",
      "## Project context",
      "",
      "- **What this is:** Internal task API for ops teams.",
      "- **Stack:** Node.js 22, Fastify, PostgreSQL 16, Fly.io.",
      "- **How it's organized:** See docs/architecture.md.",
      "- **Build / test / run commands:** npm install / npm test / npm run dev.",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(dir, "docs", "repo-memory.md"),
    [
      "# Repo Memory",
      "",
      "## What this project is",
      "",
      "Internal task-management REST API for operations teams.",
      "",
      "## Commands that matter",
      "",
      "- Install: npm install",
      "- Test: npm test",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = doctor({ target: dir });
  check("doctor reports zero placeholders on a localized install", result.todoCount === 0);
  check("doctor still reports all files present", result.checks.every((c) => c.present));

  const cli = runCli(["doctor", "--target", dir]);
  check("CLI doctor localized install exits 0", cli.status === 0);
  check(
    "CLI doctor localized install reports installed and localized",
    cli.stdout.includes("installed and localized"),
  );
});

// 8c. doctor — reports version drift between the marker and current package.
console.log("\ndoctor (version drift):");
withTempDir((dir) => {
  install({ target: dir });
  writeFileSync(join(dir, ".cursor", ".cursor-os-version"), "cursor-os 0.0.1\n", "utf8");

  const result = doctor({ target: dir });
  check("doctor exposes the installed marker version", result.markerVersion === "0.0.1");

  const cli = runCli(["doctor", "--target", dir]);
  check("CLI doctor exits 0 despite version drift", cli.status === 0);
  check(
    "CLI doctor notes the version drift",
    cli.stdout.includes("installed from cursor-os 0.0.1"),
  );
});

// 9. CLI entry point coverage.
console.log("\nCLI:");
withTempDir((dir) => {
  const help = runCli(["--help"]);
  check("--help exits 0", help.status === 0);
  check("--help prints command list", help.stdout.includes("Commands:") && help.stdout.includes("doctor"));

  const version = runCli(["--version"]);
  check("--version exits 0", version.status === 0);
  check("--version matches package.json", version.stdout.trim() === pkg.version);

  const initDefault = runCli(["init", "--target", dir]);
  check("CLI init --target exits 0", initDefault.status === 0);
  check("CLI init --target creates AGENTS.md", existsSync(join(dir, "AGENTS.md")));
  check(
    "CLI init prints a post-install check with placeholder count",
    initDefault.stdout.includes("Post-install check:") &&
      initDefault.stdout.includes("await localization"),
  );
  check(
    "CLI init points at the localization prompt",
    initDefault.stdout.includes("prompts/localize-cursor-os.md"),
  );

  const doctorInstalled = runCli(["doctor", "--target", dir]);
  check("CLI doctor installed dir exits 0", doctorInstalled.status === 0);
  check("CLI doctor installed dir reports installed", doctorInstalled.stdout.includes("Cursor OS is installed"));
});

withTempDir((dir) => {
  const dryRun = runCli(["init", "--dry-run", "--target", dir]);
  check("CLI init --dry-run exits 0", dryRun.status === 0);
  check("CLI init --dry-run prints dry-run output", dryRun.stdout.includes("Dry run complete"));
  check("CLI init --dry-run writes nothing", listAll(dir).length === 0);
});

withTempDir((dir) => {
  // Flags without a command must fail instead of silently defaulting to init.
  const directDryRun = runCli(["--dry-run"], { cwd: dir });
  check("CLI --dry-run without command exits non-zero", directDryRun.status === 1);
  check("CLI --dry-run without command prints error", directDryRun.stderr.includes("missing command"));
  check("CLI --dry-run without command writes nothing", listAll(dir).length === 0);
});

withTempDir((dir) => {
  const positional = runCli(["init", dir]);
  check("CLI init positional target exits 0", positional.status === 0);
  check("CLI init positional target creates AGENTS.md", existsSync(join(dir, "AGENTS.md")));
});

withTempDir((dir) => {
  // Bare invocation is read-only: prints help, writes nothing.
  const bare = runCli([], { cwd: dir });
  check("CLI bare invocation exits 0", bare.status === 0);
  check("CLI bare invocation prints help", bare.stdout.includes("Usage:") && bare.stdout.includes("doctor"));
  check("CLI bare invocation writes nothing", listAll(dir).length === 0);
});

withTempDir((dir) => {
  // A bare path without a command must fail instead of installing.
  const legacyPath = runCli([dir]);
  check("CLI bare path without command exits non-zero", legacyPath.status === 1);
  check("CLI bare path without command prints error", legacyPath.stderr.includes("missing command"));
  check("CLI bare path without command writes nothing", listAll(dir).length === 0);
});

withTempDir((dir) => {
  const missing = runCli(["doctor", "--target", dir]);
  check("CLI doctor empty dir exits non-zero", missing.status === 1);
  check("CLI doctor empty dir reports not installed", missing.stdout.includes("not fully installed"));
});

withTempDir((dir) => {
  // Bare relative name still resolves as a target when init is explicit.
  const bareRelative = runCli(["init", "my-project"], { cwd: dir });
  check("CLI init with bare relative name exits 0", bareRelative.status === 0);
  check("CLI init with bare relative name creates AGENTS.md inside it", existsSync(join(dir, "my-project", "AGENTS.md")));
});

withTempDir((dir) => {
  // Options before subcommand must be allowed: --target DIR doctor
  install({ target: dir });
  const targetBeforeCmd = runCli(["--target", dir, "doctor"]);
  check("CLI --target before subcommand is accepted", targetBeforeCmd.status === 0);
  check("CLI --target before subcommand runs doctor", targetBeforeCmd.stdout.includes("doctor"));
});

withTempDir((dir) => {
  // Unknown options (starting with -) must still fail
  const unknownOpt = runCli(["--frobnicate", "--dry-run"], { cwd: dir });
  check("CLI unknown option exits non-zero", unknownOpt.status === 1);
  check("CLI unknown option prints error", unknownOpt.stderr.includes("unknown option"));
  check("CLI unknown option writes nothing", listAll(dir).length === 0);
});

withTempDir((dir) => {
  const invalidTarget = runCli(["init", "--target", "--dry-run"], { cwd: dir });
  check("CLI invalid --target exits non-zero", invalidTarget.status === 1);
  check("CLI invalid --target prints error", invalidTarget.stderr.includes("requires a directory value"));
  check("CLI invalid --target writes nothing", listAll(dir).length === 0);
});

withTempDir((dir) => {
  const dryRunDoctor = runCli(["doctor", "--dry-run"], { cwd: dir });
  check("CLI doctor --dry-run exits non-zero", dryRunDoctor.status === 1);
  check("CLI doctor --dry-run prints error", dryRunDoctor.stderr.includes("--dry-run is only valid with init"));
});

console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Smoke test passed.");
