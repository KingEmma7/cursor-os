#!/usr/bin/env node
// Cursor OS installer.
// Copies the template/ kit into a target project. Idempotent: never overwrites
// user files (skips them), supports --dry-run, and refreshes a version marker.
// Node built-ins only — no dependencies.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  realpathSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const templateDir = join(repoRoot, "template");
const MARKER_REL = join(".cursor", ".cursor-os-version");

function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// ── Argument parsing ──────────────────────────────────────────────────────────

/**
 * Parse argv into { command, dryRun, target, help, version }.
 * command: "init" | "doctor" | null
 *
 * Supported forms:
 *   node init.mjs [init] [target] [--dry-run] [--target DIR]
 *   node init.mjs doctor [target] [--target DIR]
 *   node init.mjs --help | -h
 *   node init.mjs --version | -v
 */
function parseArgs(argv) {
  const args = {
    command: null,
    dryRun: false,
    target: process.cwd(),
    help: false,
    version: false,
    errors: [],
  };
  let targetSet = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { args.help = true; }
    else if (a === "--version" || a === "-v") { args.version = true; }
    else if (a === "--dry-run" || a === "-n") { args.dryRun = true; }
    else if (a === "--target" || a === "-t") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        args.errors.push(`${a} requires a directory value`);
      } else {
        args.target = value;
        targetSet = true;
        i++;
      }
    }
    else if ((a === "init" || a === "doctor") && args.command === null) {
      // Subcommand recognized regardless of whether --target has already been set
      args.command = a;
    }
    else if (a.startsWith("-")) {
      args.errors.push(`unknown option: ${a}`);
    }
    else if (!targetSet) {
      // Any bare, non-flag, non-subcommand word is a target path.
      // This preserves backwards-compat for `node init.mjs my-project` as well
      // as absolute or slash-prefixed paths.
      args.target = a;
      targetSet = true;
    } else {
      args.errors.push(`unexpected argument: ${a}`);
    }
  }

  // Default command
  if (args.command === null && !args.help && !args.version) {
    args.command = "init";
  }

  if (args.command === "doctor" && args.dryRun) {
    args.errors.push("--dry-run is only valid with init");
  }

  return args;
}


const HELP = `Cursor OS — installer

Usage:
  node scripts/init.mjs [command] [target] [options]

Commands:
  init      Install Cursor OS into the target directory (default)
  doctor    Check whether Cursor OS is installed in the target directory

Arguments:
  target    Directory to operate on (default: current directory)

Options:
  -n, --dry-run     Preview changes without writing anything (init only)
  -t, --target DIR  Use DIR as the target directory
  -v, --version     Print version and exit
  -h, --help        Show this help

Examples:
  node scripts/init.mjs
  node scripts/init.mjs init
  node scripts/init.mjs init --dry-run
  node scripts/init.mjs init --target ./my-project
  node scripts/init.mjs doctor
  node scripts/init.mjs doctor --target ./my-project

The installer copies AGENTS.md, .cursor/, docs/, and prompts/ into the target.
It never overwrites existing user files — it skips them and reports.
After installing, open Cursor and run prompts/localize-cursor-os.md.`;

// ── File helpers ──────────────────────────────────────────────────────────────

/** Recursively collect files under dir as paths relative to dir. */
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      for (const child of listFiles(full)) out.push(join(entry, child));
    } else {
      out.push(entry);
    }
  }
  return out;
}

// ── install ───────────────────────────────────────────────────────────────────

/**
 * Plan + apply the install.
 * Returns { created, updated, skipped, target, dryRun, version }.
 * Never overwrites user files: any template path that already exists is skipped.
 */
export function install({ target, dryRun = false } = {}) {
  if (!target) throw new Error("install() requires a target directory");
  if (!existsSync(templateDir)) {
    throw new Error(`template directory not found at ${templateDir}`);
  }

  const version = readVersion();
  const result = { created: [], updated: [], skipped: [], target, dryRun, version };

  const write = (rel, writer) => {
    const dest = join(target, rel);
    if (existsSync(dest)) {
      result.skipped.push(rel);
      return;
    }
    if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      writer(dest);
    }
    result.created.push(rel);
  };

  for (const rel of listFiles(templateDir).sort()) {
    const src = join(templateDir, rel);
    write(rel, (dest) => copyFileSync(src, dest));
  }

  const markerDest = join(target, MARKER_REL);
  if (existsSync(markerDest)) {
    if (!dryRun) {
      writeFileSync(markerDest, `cursor-os ${version}\n`, "utf8");
    }
    result.updated.push(MARKER_REL);
  } else {
    write(MARKER_REL, (dest) =>
      writeFileSync(dest, `cursor-os ${version}\n`, "utf8"),
    );
  }

  return result;
}

// ── doctor ────────────────────────────────────────────────────────────────────

function doctorChecks() {
  if (!existsSync(templateDir)) {
    throw new Error(`template directory not found at ${templateDir}`);
  }

  return [
    ...listFiles(templateDir).sort().map((rel) => ({ rel, label: rel })),
    { rel: MARKER_REL, label: MARKER_REL },
  ];
}

/**
 * Check whether Cursor OS appears installed in target.
 * Returns { checks: [{label, present, note}], todoCount, target }.
 * Never modifies files.
 */
export function doctor({ target } = {}) {
  if (!target) throw new Error("doctor() requires a target directory");

  const checks = doctorChecks().map(({ rel, label }) => {
    const fullPath = join(target, rel);
    const present = existsSync(fullPath);
    let note = null;
    let todoCount = 0;

    if (present) {
      // Flag unfilled TODO placeholders in key prose files
      const TODO_FILES = ["AGENTS.md", join("docs", "repo-memory.md")];
      if (TODO_FILES.includes(rel)) {
        try {
          const content = readFileSync(fullPath, "utf8");
          todoCount = (content.match(/\bTODO\b/g) ?? []).length;
          if (todoCount > 0) note = `${todoCount} TODO placeholder(s) remain — run prompts/localize-cursor-os.md`;
        } catch {
          // ignore read errors
        }
      }
    }

    return { label, present, note, todoCount };
  });

  const todoCount = checks.reduce((n, c) => n + c.todoCount, 0);
  return { checks, todoCount, target };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

function runInit(args) {
  const result = install(args);
  console.log(`Cursor OS v${result.version}${args.dryRun ? " (dry run)" : ""}`);
  console.log(`Target: ${args.target}\n`);

  const verb = args.dryRun ? "Would create" : "Created";
  if (result.created.length) {
    console.log(`${verb} ${result.created.length} file(s):`);
    for (const f of result.created) console.log(`  + ${f}`);
  }
  if (result.skipped.length) {
    console.log(`\nSkipped ${result.skipped.length} existing file(s):`);
    for (const f of result.skipped) console.log(`  = ${f}`);
  }
  if (result.updated.length) {
    const updateVerb = args.dryRun ? "Would refresh" : "Refreshed";
    console.log(`\n${updateVerb} ${result.updated.length} generated file(s):`);
    for (const f of result.updated) console.log(`  ~ ${f}`);
  }

  if (args.dryRun) {
    console.log("\nDry run complete — no files were written.");
  } else {
    const where = relative(repoRoot, args.target) || "this repo";
    console.log(`\nDone. Next: open Cursor and run prompts/localize-cursor-os.md to adapt the OS to ${where}.`);
  }
}

function runDoctor(args) {
  const result = doctor({ target: args.target });
  const version = readVersion();
  console.log(`Cursor OS v${version} — doctor`);
  console.log(`Target: ${args.target}\n`);

  let allPresent = true;
  for (const { label, present, note } of result.checks) {
    const symbol = present ? "ok " : "MISSING";
    console.log(`  ${symbol}  ${label}`);
    if (note) console.log(`        note: ${note}`);
    if (!present) allPresent = false;
  }

  console.log("");
  if (allPresent && result.todoCount === 0) {
    console.log("Cursor OS appears installed and localized.");
  } else if (allPresent) {
    console.log("Cursor OS is installed. Run prompts/localize-cursor-os.md to complete setup.");
  } else {
    console.log("Cursor OS is not fully installed. Run: node scripts/init.mjs init");
    process.exitCode = 1;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.errors.length) {
    for (const error of args.errors) console.error(`Error: ${error}`);
    console.error(`\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  if (args.version) {
    console.log(readVersion());
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }

  try {
    if (args.command === "doctor") {
      runDoctor(args);
    } else {
      runInit(args);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// Only run main when invoked directly, not when imported by the smoke test.
// realpathSync normalizes symlinks (e.g. macOS /tmp → /private/tmp).
function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1])
    );
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isDirectInvocation()) {
  main();
}
