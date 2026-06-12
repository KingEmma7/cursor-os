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
  lstatSync,
  realpathSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const templateDir = join(repoRoot, "template");
const MARKER_REL = join(".cursor", ".cursor-os-version");

// Prose files doctor scans for unfilled placeholder markers.
const TODO_FILES = ["AGENTS.md", join("docs", "repo-memory.md")];

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
 *   node init.mjs init [target] [--dry-run] [--target DIR]
 *   node init.mjs doctor [target] [--target DIR]
 *   node init.mjs --help | -h
 *   node init.mjs --version | -v
 *
 * A command is required when any other argument is given. A bare invocation
 * with no arguments prints help — it never writes files.
 */
function parseArgs(argv) {
  const args = {
    command: null,
    dryRun: false,
    target: process.cwd(),
    help: false,
    version: false,
    bare: argv.length === 0,
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
      // Any bare, non-flag, non-subcommand word is a target path
      // (absolute, relative, or a plain directory name).
      args.target = a;
      targetSet = true;
    } else {
      args.errors.push(`unexpected argument: ${a}`);
    }
  }

  // A command is required whenever arguments are given. Bare invocation
  // (no args at all) falls through to help so `npx cursor-os` is read-only.
  if (args.command === null && !args.help && !args.version && !args.bare) {
    args.errors.push("missing command: specify 'init' or 'doctor'");
  }

  if (args.command === "doctor" && args.dryRun) {
    args.errors.push("--dry-run is only valid with init");
  }

  return args;
}


const HELP = `Cursor OS — installer

Usage:
  cursor-os <command> [target] [options]

Commands:
  init      Install Cursor OS into the target directory
  doctor    Check whether Cursor OS is installed in the target directory

Arguments:
  target    Directory to operate on (default: current directory)

Options:
  -n, --dry-run     Preview changes without writing anything (init only)
  -t, --target DIR  Use DIR as the target directory
  -v, --version     Print version and exit
  -h, --help        Show this help

Examples:
  cursor-os init
  cursor-os init --dry-run
  cursor-os init --target ./my-project
  cursor-os doctor
  cursor-os doctor --target ./my-project

Notes:
  A command is required; bare invocation prints this help and writes nothing.
  For a target directory named "init" or "doctor", or one starting with "-",
  use the explicit form: init --target <dir>.
  When running from a local checkout: node scripts/init.mjs <command>

The installer copies AGENTS.md, .cursor/, docs/, and prompts/ into the target.
It never overwrites existing user files — it skips them and reports.
After installing, open Cursor and run prompts/localize-cursor-os.md.`;

// ── File helpers ──────────────────────────────────────────────────────────────

/**
 * Recursively collect files under dir as paths relative to dir.
 * Uses lstat so symlinked directories are not recursed into (prevents cycles).
 * Symlinks to files are included and copied as their target's content by
 * copyFileSync; symlinks to directories are skipped (not recursed, not copied).
 */
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (lstatSync(full).isDirectory()) {
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

/** Read the installed version from the marker file, or null if unreadable. */
function readMarkerVersion(target) {
  try {
    const content = readFileSync(join(target, MARKER_REL), "utf8");
    return content.match(/cursor-os (\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Check whether Cursor OS appears installed in target.
 * Returns { checks: [{label, present, note}], todoCount, markerVersion, target }.
 * Never modifies files.
 */
export function doctor({ target } = {}) {
  if (!target) throw new Error("doctor() requires a target directory");

  const checks = doctorChecks().map(({ rel, label }) => {
    const fullPath = join(target, rel);
    const present = existsSync(fullPath);
    let note = null;
    let todoCount = 0;

    // Flag unfilled TODO placeholders in key prose files
    if (present && TODO_FILES.includes(rel)) {
      try {
        const content = readFileSync(fullPath, "utf8");
        todoCount = (content.match(/\bTODO\b/g) ?? []).length;
        if (todoCount > 0) note = `${todoCount} TODO placeholder(s) remain — run prompts/localize-cursor-os.md`;
      } catch {
        // ignore read errors
      }
    }

    return { label, present, note, todoCount };
  });

  const todoCount = checks.reduce((n, c) => n + c.todoCount, 0);
  return { checks, todoCount, markerVersion: readMarkerVersion(target), target };
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
    return;
  }

  // Post-install health check: confirm the install and surface what
  // localization still needs to fill in, so the next step is unmissable.
  const health = doctor({ target: args.target });
  const missing = health.checks.filter((c) => !c.present).length;
  // Show a relative path only when the target is inside this checkout.
  const rel = relative(repoRoot, args.target);
  let where = rel || "this repo";
  if (rel.startsWith("..")) where = resolve(args.target);

  console.log("\nPost-install check:");
  if (missing > 0) {
    console.log(`  ${missing} expected file(s) missing — run: cursor-os doctor --target ${args.target}`);
  } else if (health.todoCount > 0) {
    console.log(`  All files installed. ${health.todoCount} placeholder(s) await localization.`);
  } else {
    console.log("  All files installed and localized.");
  }

  if (health.todoCount > 0) {
    console.log(`\nNext: open Cursor in ${where} and run prompts/localize-cursor-os.md to adapt the OS to your project.`);
    console.log('Tip: with the Cursor CLI installed you can run it directly:');
    console.log('  cursor-agent -p "$(cat prompts/localize-cursor-os.md)"');
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

  if (result.markerVersion && result.markerVersion !== version) {
    console.log(`\n  note: installed from cursor-os ${result.markerVersion}; current is ${version}.`);
    console.log("        Re-run init to add any files introduced since (existing files are never overwritten).");
  }

  console.log("");
  if (allPresent && result.todoCount === 0) {
    console.log("Cursor OS appears installed and localized.");
  } else if (allPresent) {
    console.log("Cursor OS is installed. Run prompts/localize-cursor-os.md to complete setup.");
  } else {
    console.log("Cursor OS is not fully installed. Run: cursor-os init");
    process.exitCode = 1;
  }
}

// Minimum supported Node major version. Keep in sync with package.json engines.
const MIN_NODE_MAJOR = 20;

function main() {
  // engines in package.json is advisory only — fail fast with a clear message.
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < MIN_NODE_MAJOR) {
    console.error(
      `Error: cursor-os requires Node.js ${MIN_NODE_MAJOR} or newer (you are running ${process.versions.node}).`,
    );
    process.exitCode = 1;
    return;
  }

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

  if (args.help || args.bare) {
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
