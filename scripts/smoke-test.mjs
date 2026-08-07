#!/usr/bin/env node
// Smoke test for the Cursor OS installer.
// Verifies: files are copied into a scratch dir, --dry-run writes nothing,
// existing user files are never overwritten, the version marker is refreshed,
// doctor passes on an installed dir, and doctor reports missing files otherwise.
// Node built-ins only.

import { install, doctor, detect } from "./init.mjs";
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
import { createHash } from "node:crypto";
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
  check("clean install refreshes nothing", result.updated.length === 0);
  check("reports nothing skipped on a clean install", result.skipped.length === 0);
  check("reports nothing stale on a clean install", result.stale.length === 0);
  check("reports nothing customized on a clean install", result.customized.length === 0);
  check("writes an install manifest", existsSync(join(dir, ".cursor", ".cursor-os-manifest.json")));
  check(
    "counts the manifest as created, not refreshed",
    result.created.includes(join(".cursor", ".cursor-os-manifest.json")),
  );
});

// 2. --dry-run writes nothing.
console.log("\ndry run:");
withTempDir((dir) => {
  const result = install({ target: dir, dryRun: true });
  check("dry run reports files it would create", result.created.length > 0);
  check("dry run refreshes nothing in an empty dir", result.updated.length === 0);
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
    result.updated.includes(join(".cursor", ".cursor-os-version")),
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
  check(
    "reports the pre-existing, user-authored file as customized",
    result.customized.includes("AGENTS.md") && !result.skipped.includes("AGENTS.md"),
  );
  check("still creates the other files", existsSync(join(dir, "docs", "repo-memory.md")));

  // Re-running is a no-op: everything already present is skipped.
  const second = install({ target: dir });
  check("second run creates nothing new", second.created.length === 0);
  check(
    "second run refreshes only generated files",
    second.updated.length === 2 &&
      second.updated.includes(join(".cursor", ".cursor-os-version")) &&
      second.updated.includes(join(".cursor", ".cursor-os-manifest.json")),
  );
  check(
    "second run leaves every template file untouched",
    second.skipped.length + second.stale.length + second.customized.length === EXPECTED.length,
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

// 9. detect — reports evidence-backed stack signals and never writes.
console.log("\ndetect (project signals):");
withTempDir((dir) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "detected-app",
        private: true,
        packageManager: "pnpm@9.15.0",
        workspaces: ["apps/*"],
        scripts: {
          build: "next build",
          dev: "next dev",
          test: "vitest run",
        },
        dependencies: {
          "@supabase/supabase-js": "^2.0.0",
          next: "^15.0.0",
          react: "^19.0.0",
        },
        devDependencies: {
          tailwindcss: "^4.0.0",
          typescript: "^5.0.0",
          vitest: "^3.0.0",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  writeFileSync(join(dir, "tsconfig.json"), "{}\n", "utf8");
  writeFileSync(join(dir, "vercel.json"), "{}\n", "utf8");
  writeFileSync(join(dir, "turbo.json"), "{}\n", "utf8");
  const before = listAll(dir);

  const result = detect({ target: dir });
  check("detect reads project name", result.project.name === "detected-app");
  check("detect reads package manager", result.project.packageManager === "pnpm");
  check("detect finds TypeScript", result.languages.includes("TypeScript"));
  check("detect finds Next.js", result.frameworks.includes("Next.js"));
  check("detect finds React", result.frameworks.includes("React"));
  check("detect finds Supabase", result.services.includes("Supabase"));
  check("detect finds Vercel", result.services.includes("Vercel"));
  check("detect finds tooling", result.tooling.includes("Tailwind CSS") && result.tooling.includes("Vitest"));
  check("detect identifies Turborepo tooling from its config", result.tooling.includes("Turborepo"));
  check(
    "detect emits stack presets",
    ["nextjs", "supabase", "vercel"].every((preset) => result.presets.includes(preset)),
  );
  check("detect identifies a monorepo", result.workspace.monorepo === true);
  check("detect preserves package scripts", result.packageScripts.test === "vitest run");
  check("detect includes signal evidence", result.evidence.some((item) => item.source === "package.json:next"));
  check("detect writes no files", JSON.stringify(listAll(dir)) === JSON.stringify(before));
});

console.log("\ndetect (task runner without workspace):");
withTempDir((dir) => {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "single-package" }), "utf8");
  writeFileSync(join(dir, "turbo.json"), "{}\n", "utf8");
  writeFileSync(join(dir, "nx.json"), "{}\n", "utf8");

  const result = detect({ target: dir });
  check("task-runner configs do not imply a monorepo", result.workspace.monorepo === false);
  check("task-runner configs are not workspace indicators", result.workspace.indicators.length === 0);
  check(
    "task-runner configs still identify tooling",
    result.tooling.includes("Turborepo") && result.tooling.includes("Nx"),
  );
});

console.log("\ndetect (malformed manifests):");
withTempDir((dir) => {
  writeFileSync(join(dir, "package.json"), "{not json", "utf8");
  writeFileSync(join(dir, "package-lock.json"), "{}\n", "utf8");
  writeFileSync(join(dir, "yarn.lock"), "# lock\n", "utf8");

  const result = detect({ target: dir });
  check("detect reports malformed package.json as a warning", result.warnings.some((warning) => warning.startsWith("package.json:")));
  check("detect reports multiple lockfiles", result.warnings.some((warning) => warning.includes("multiple package-manager lockfiles")));
  check("detect still identifies a package manager", result.project.packageManager === "yarn");
});

// 10. CLI entry point coverage.
console.log("\nCLI:");
withTempDir((dir) => {
  const help = runCli(["--help"]);
  check("--help exits 0", help.status === 0);
  check(
    "--help prints command list",
    help.stdout.includes("Commands:") && help.stdout.includes("doctor") && help.stdout.includes("detect"),
  );

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
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "cli-detect", dependencies: { next: "^15.0.0" } }),
    "utf8",
  );
  writeFileSync(join(dir, "vercel.json"), "{}\n", "utf8");
  const before = listAll(dir);

  const text = runCli(["detect", "--target", dir]);
  check("CLI detect text exits 0", text.status === 0);
  check("CLI detect text reports project", text.stdout.includes("Project: cli-detect"));
  check("CLI detect text reports stack signals", text.stdout.includes("Next.js") && text.stdout.includes("Vercel"));

  const json = runCli(["detect", "--target", dir, "--format", "json"]);
  const parsed = json.status === 0 ? JSON.parse(json.stdout) : null;
  check("CLI detect JSON exits 0", json.status === 0);
  check("CLI detect JSON is parseable", parsed?.schemaVersion === 1);
  check("CLI detect JSON includes evidence", parsed?.evidence?.length > 0);
  check("CLI detect remains read-only", JSON.stringify(listAll(dir)) === JSON.stringify(before));
});

withTempDir((dir) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ dependencies: { next: "^15.0.0", "@supabase/supabase-js": "^2.0.0" } }),
    "utf8",
  );
  const initDetected = runCli(["init", "--target", dir]);
  check("CLI init with detectable project exits 0", initDetected.status === 0);
  check("CLI init prints detected project signals", initDetected.stdout.includes("Detected project signals: Next.js, Supabase"));
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

withTempDir((dir) => {
  const invalidFormat = runCli(["detect", "--format", "yaml"], { cwd: dir });
  check("CLI detect rejects unsupported format", invalidFormat.status === 1);
  check("CLI detect unsupported format prints error", invalidFormat.stderr.includes("unsupported format: yaml"));

  const dryRunDetect = runCli(["detect", "--dry-run"], { cwd: dir });
  check("CLI detect --dry-run exits non-zero", dryRunDetect.status === 1);
  check("CLI detect --dry-run prints error", dryRunDetect.stderr.includes("--dry-run is only valid with init"));
});


// ── Regression coverage added by the audit ────────────────────────────────────

// Optional (prunable) rules: localization is told to delete frontend.mdc when
// the project has no UI. doctor must not call that a broken install.
console.log("\npruned optional rules:");
withTempDir((dir) => {
  install({ target: dir });
  rmSync(join(dir, ".cursor", "rules", "frontend.mdc"));
  const health = doctor({ target: dir });
  check("pruning frontend.mdc leaves zero required files missing", health.missingRequired === 0);
  const pruned = health.checks.find((c) => c.label === join(".cursor", "rules", "frontend.mdc"));
  check("pruned optional rule is flagged optional, not missing", pruned.optional === true && pruned.present === false);

  const cli = runCli(["doctor", "--target", dir]);
  check("CLI doctor exits 0 after an optional rule is pruned", cli.status === 0);
  check("CLI doctor labels the pruned rule", cli.stdout.includes("pruned"));
  check("CLI doctor does not claim a broken install", !cli.stdout.includes("not fully installed"));

  // A required file going missing must still fail.
  rmSync(join(dir, "AGENTS.md"));
  const broken = runCli(["doctor", "--target", dir]);
  check("CLI doctor still fails when a required file is missing", broken.status === 1);
});

// Target validation: a typo must not scatter the kit into a fabricated tree.
console.log("\ntarget validation:");
withTempDir((dir) => {
  const deep = join(dir, "no", "such", "tree");
  const cli = runCli(["init", "--target", deep]);
  check("init refuses a target whose parent does not exist", cli.status === 1);
  check("init explains the missing parent", cli.stderr.includes("parent"));
  check("init wrote nothing for the bad target", !existsSync(join(dir, "no")));

  const oneLevel = join(dir, "new-project");
  const ok = runCli(["init", "--target", oneLevel]);
  check("init still creates a single new directory level", ok.status === 0);
  check("init populated the new directory", existsSync(join(oneLevel, "AGENTS.md")));

  const filePath = join(dir, "a-file.txt");
  writeFileSync(filePath, "not a directory\n", "utf8");
  const notDir = runCli(["init", "--target", filePath]);
  check("init rejects a file as target", notDir.status === 1);
  check("init names the not-a-directory problem", notDir.stderr.includes("not a directory"));

  const missingDoctor = runCli(["doctor", "--target", join(dir, "absent")]);
  check("doctor on a missing dir exits non-zero", missingDoctor.status === 1);
  check(
    "doctor on a missing dir says the dir is missing, not that the OS is uninstalled",
    missingDoctor.stderr.includes("does not exist") && !missingDoctor.stdout.includes("not fully installed"),
  );
});

// --update: refresh stale kit files, never clobber edited ones.
console.log("\nupdate semantics:");
withTempDir((dir) => {
  install({ target: dir });
  const corePath = join(dir, ".cursor", "rules", "core.mdc");
  const agentsPath = join(dir, "AGENTS.md");
  const pristineCore = readFileSync(corePath, "utf8");

  // Simulate a stale file from an older release by rewriting the manifest hash
  // to match the on-disk content after we mutate it... instead, mutate the file
  // and re-record it, which is exactly the "installed, never edited" state.
  writeFileSync(corePath, "stale content from an older release\n", "utf8");
  const manifestPath = join(dir, ".cursor", ".cursor-os-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.files[".cursor/rules/core.mdc"] = createHash("sha256")
    .update(readFileSync(corePath))
    .digest("hex");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  // A genuine user edit, which must survive --update.
  const userEdit = readFileSync(agentsPath, "utf8") + "\n## Our team rule\nAlways run make check.\n";
  writeFileSync(agentsPath, userEdit, "utf8");

  const preview = install({ target: dir, update: true, dryRun: true });
  check("update dry-run reports the stale file as refreshable", preview.refreshed.includes(join(".cursor", "rules", "core.mdc")));
  check("plain init classifies it as stale, not skipped", (() => {
    const plain = install({ target: dir, dryRun: true });
    return plain.stale.includes(join(".cursor", "rules", "core.mdc"))
      && !plain.skipped.includes(join(".cursor", "rules", "core.mdc"));
  })());
  check("update dry-run writes nothing", readFileSync(corePath, "utf8") === "stale content from an older release\n");

  const applied = install({ target: dir, update: true });
  check("update refreshes the unedited stale file", readFileSync(corePath, "utf8") === pristineCore);
  check("update preserves the user-edited file byte-for-byte", readFileSync(agentsPath, "utf8") === userEdit);
  check("update reports the edited file as customized", applied.customized.includes("AGENTS.md"));

  const cli = runCli(["init", "--update", "--target", dir]);
  check("CLI init --update exits 0", cli.status === 0);

  const badFlag = runCli(["doctor", "--update", "--target", dir]);
  check("CLI rejects --update outside init", badFlag.status === 1);
  check("CLI explains the --update restriction", badFlag.stderr.includes("--update is only valid with init"));
});

// Plain init must never overwrite, even when a file is stale.
console.log("\ninit without --update never overwrites:");
withTempDir((dir) => {
  install({ target: dir });
  const corePath = join(dir, ".cursor", "rules", "core.mdc");
  writeFileSync(corePath, "user rewrote this\n", "utf8");
  const result = install({ target: dir });
  check("plain init leaves the edited file alone", readFileSync(corePath, "utf8") === "user rewrote this\n");
  check("plain init reports it as customized", result.customized.includes(join(".cursor", "rules", "core.mdc")));
  check("an edited file is never reported as stale", !result.stale.includes(join(".cursor", "rules", "core.mdc")));
});

// Regression: a stray .DS_Store in template/ used to be copied into every install
// and broke three count-based checks, on macOS only.
console.log("\nOS artifacts in template/:");
withTempDir((dir) => {
  const junk = join(repoRoot, "template", ".DS_Store");
  const preexisting = existsSync(junk);
  if (!preexisting) writeFileSync(junk, "", "utf8");
  try {
    const result = install({ target: dir });
    check("install ignores .DS_Store in template/", !result.created.some((f) => f.includes(".DS_Store")));
    check("no OS artifact reaches the target", !existsSync(join(dir, ".DS_Store")));
    check("expected file count is unchanged", result.created.length === EXPECTED.length + 2);
    check("doctor does not check for OS artifacts",
      !doctor({ target: dir }).checks.some((c) => c.label.includes(".DS_Store")));
  } finally {
    if (!preexisting) rmSync(junk, { force: true });
  }
});

console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Smoke test passed.");
