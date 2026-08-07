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
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";
import { detect, formatDetectionText } from "./detect.mjs";

export { detect } from "./detect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const templateDir = join(repoRoot, "template");
const MARKER_REL = join(".cursor", ".cursor-os-version");
const MANIFEST_REL = join(".cursor", ".cursor-os-manifest.json");

// Prose files doctor scans for unfilled placeholder markers.
const TODO_FILES = ["AGENTS.md", join("docs", "repo-memory.md")];

// OS and editor artifacts that must never be treated as part of the kit. Without
// this, a Finder visit to template/ adds .DS_Store to every install and breaks the
// count-based smoke checks on macOS only, where CI cannot see it.
const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".AppleDouble"]);

// Opt-in rules that localization is instructed to delete when they don't apply
// (see prompts/localize-cursor-os.md, step 7). doctor reports these as pruned
// rather than missing, so a correctly localized project still passes.
const OPTIONAL_FILES = new Set([
  join(".cursor", "rules", "frontend.mdc"),
  join(".cursor", "rules", "debugging.mdc"),
]);

/** Stable manifest key, independent of the platform path separator. */
function manifestKey(rel) {
  return rel.split(sep).join("/");
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Read the install manifest, or null when absent/unreadable (pre-0.3 installs). */
function readManifest(target) {
  try {
    const parsed = JSON.parse(readFileSync(join(target, MANIFEST_REL), "utf8"));
    return parsed && parsed.files && typeof parsed.files === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validate a target path. An existing target must be a directory.
 *
 * A missing target is acceptable only for init, and only one level below an
 * existing parent: `cursor-os init my-project` keeps working, while a typo such
 * as `--target ../projcts/app/web` is refused instead of silently creating the
 * whole tree. doctor and detect always reject a missing target so the user sees
 * "no such directory" rather than "not installed".
 */
function assertUsableTarget(target, { allowCreate = false } = {}) {
  const resolved = resolve(target);
  if (existsSync(resolved)) {
    if (!statSync(resolved).isDirectory()) {
      throw new Error(`target is not a directory: ${resolved}`);
    }
    return resolved;
  }
  if (!allowCreate) {
    throw new Error(
      `target directory does not exist: ${resolved}\n       Check the path, or run init there first.`,
    );
  }
  const parent = dirname(resolved);
  if (!existsSync(parent) || !statSync(parent).isDirectory()) {
    throw new Error(
      `target directory does not exist: ${resolved}\n       Its parent (${parent}) does not exist either. Check the path for a typo;\n       cursor-os creates at most one new directory level.`,
    );
  }
  return resolved;
}

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
 * Parse argv into { command, dryRun, target, format, help, version }.
 * command: "init" | "doctor" | "detect" | null
 *
 * Supported forms:
 *   node init.mjs init [target] [--dry-run] [--target DIR]
 *   node init.mjs doctor [target] [--target DIR]
 *   node init.mjs detect [target] [--target DIR] [--format text|json]
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
    update: false,
    format: "text",
    target: process.cwd(),
    help: false,
    version: false,
    bare: argv.length === 0,
    errors: [],
  };
  let targetSet = false;
  let formatSet = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { args.help = true; }
    else if (a === "--version" || a === "-v") { args.version = true; }
    else if (a === "--dry-run" || a === "-n") { args.dryRun = true; }
    else if (a === "--update" || a === "-u") { args.update = true; }
    else if (a === "--format") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        args.errors.push("--format requires text or json");
      } else if (value !== "text" && value !== "json") {
        args.errors.push(`unsupported format: ${value}`);
        i++;
      } else {
        args.format = value;
        formatSet = true;
        i++;
      }
    }
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
    else if ((a === "init" || a === "doctor" || a === "detect") && args.command === null) {
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
    args.errors.push("missing command: specify 'init', 'doctor' or 'detect'");
  }

  if (args.command !== "init" && args.dryRun) {
    args.errors.push("--dry-run is only valid with init");
  }

  if (args.command !== "init" && args.update) {
    args.errors.push("--update is only valid with init");
  }

  if (args.command !== "detect" && formatSet) {
    args.errors.push("--format is only valid with detect");
  }

  return args;
}


const HELP = `Cursor OS — installer

Usage:
  cursor-os <command> [target] [options]

Commands:
  init      Install Cursor OS into the target directory
  doctor    Check whether Cursor OS is installed in the target directory
  detect    Read project manifests and report stack signals (never writes)

Arguments:
  target    Directory to operate on (default: current directory)

Options:
  -n, --dry-run     Preview changes without writing anything (init only)
  -u, --update      Refresh kit files you never edited to the current version (init only)
  -t, --target DIR  Use DIR as the target directory
      --format TYPE Output text or json (detect only; default: text)
  -v, --version     Print version and exit
  -h, --help        Show this help

Examples:
  cursor-os init
  cursor-os init --dry-run
  cursor-os init --update --dry-run
  cursor-os init --target ./my-project
  cursor-os doctor
  cursor-os doctor --target ./my-project
  cursor-os detect
  cursor-os detect --target ./my-project --format json

Notes:
  A command is required; bare invocation prints this help and writes nothing.
  The target directory must already exist.
  For a target directory named "init", "doctor" or "detect", or one starting with "-",
  use the intended command with the explicit form: <command> --target <dir>.
  When running from a local checkout: node scripts/init.mjs <command>

The installer copies AGENTS.md, .cursor/, docs/, and prompts/ into the target.
It never overwrites a file you have edited. With --update it refreshes only the
files that still match what a previous install wrote; anything else is reported
as customized so you can merge it yourself.
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
    if (IGNORED_NAMES.has(entry)) continue;
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
export function install({ target, dryRun = false, update = false } = {}) {
  if (!target) throw new Error("install() requires a target directory");
  if (!existsSync(templateDir)) {
    throw new Error(`template directory not found at ${templateDir}`);
  }
  assertUsableTarget(target, { allowCreate: true });

  const version = readVersion();
  const result = {
    created: [],
    refreshed: [],
    skipped: [],
    stale: [],
    customized: [],
    updated: [],
    target,
    dryRun,
    update,
    version,
  };

  const priorManifest = readManifest(target);
  const nextFiles = {};

  for (const rel of listFiles(templateDir).sort()) {
    const src = join(templateDir, rel);
    const dest = join(target, rel);
    const templateHash = hashFile(src);
    const key = manifestKey(rel);

    if (!existsSync(dest)) {
      if (!dryRun) {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      }
      result.created.push(rel);
      nextFiles[key] = templateHash;
      continue;
    }

    const currentHash = hashFile(dest);
    if (currentHash === templateHash) {
      // Byte-identical to the shipped template; nothing to do.
      result.skipped.push(rel);
      nextFiles[key] = templateHash;
      continue;
    }

    // The file differs from the template. The manifest tells us whether that is
    // an edit worth preserving or drift from an older release worth refreshing.
    const recordedHash = priorManifest?.files?.[key] ?? null;
    const untouchedSinceInstall = recordedHash !== null && recordedHash === currentHash;

    if (update && untouchedSinceInstall) {
      if (!dryRun) copyFileSync(src, dest);
      result.refreshed.push(rel);
      nextFiles[key] = templateHash;
    } else {
      // Never overwrite an edit. Without a manifest every difference is treated
      // as an edit, which is the safe reading for installs predating 0.3.0.
      if (untouchedSinceInstall) result.stale.push(rel);
      else result.customized.push(rel);
      nextFiles[key] = recordedHash ?? currentHash;
    }
  }

  const markerDest = join(target, MARKER_REL);
  if (existsSync(markerDest)) {
    if (!dryRun) writeFileSync(markerDest, `cursor-os ${version}\n`, "utf8");
    result.updated.push(MARKER_REL);
  } else {
    if (!dryRun) {
      mkdirSync(dirname(markerDest), { recursive: true });
      writeFileSync(markerDest, `cursor-os ${version}\n`, "utf8");
    }
    result.created.push(MARKER_REL);
  }

  const manifestDest = join(target, MANIFEST_REL);
  const manifestExisted = existsSync(manifestDest);
  if (!dryRun) {
    mkdirSync(dirname(manifestDest), { recursive: true });
    writeFileSync(
      manifestDest,
      `${JSON.stringify({ schemaVersion: 1, version, files: nextFiles }, null, 2)}\n`,
      "utf8",
    );
  }
  (manifestExisted ? result.updated : result.created).push(MANIFEST_REL);

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
  assertUsableTarget(target);

  const checks = doctorChecks().map(({ rel, label }) => {
    const fullPath = join(target, rel);
    const present = existsSync(fullPath);
    const optional = OPTIONAL_FILES.has(rel);
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

    if (!present && optional) {
      note = "optional rule — absent because localization pruned it, or never installed";
    }

    return { label, present, optional, note, todoCount };
  });

  const todoCount = checks.reduce((n, c) => n + c.todoCount, 0);
  const missingRequired = checks.filter((c) => !c.present && !c.optional).length;
  return {
    checks,
    todoCount,
    missingRequired,
    markerVersion: readMarkerVersion(target),
    target,
  };
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
  if (result.refreshed.length) {
    const refreshVerb = args.dryRun ? "Would refresh" : "Refreshed";
    console.log(`\n${refreshVerb} ${result.refreshed.length} unedited file(s):`);
    for (const f of result.refreshed) console.log(`  ^ ${f}`);
  }
  if (result.skipped.length) {
    console.log(`\nSkipped ${result.skipped.length} up-to-date file(s):`);
    for (const f of result.skipped) console.log(`  = ${f}`);
  }
  if (result.stale.length) {
    console.log(`\n${result.stale.length} unedited file(s) are behind the current template:`);
    for (const f of result.stale) console.log(`  ! ${f}`);
    console.log("  Run init --update to refresh them.");
  }
  if (result.customized.length) {
    console.log(`\nKept ${result.customized.length} edited file(s):`);
    for (const f of result.customized) console.log(`  * ${f}`);
    console.log("  These differ from the current template. Merge by hand if you want the new version.");
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
  const missing = health.missingRequired;
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
    const project = detect({ target: args.target });
    const signals = [...project.frameworks, ...project.services, ...project.tooling].slice(0, 8);
    if (signals.length > 0) {
      console.log(`\nDetected project signals: ${signals.join(", ")}`);
    }
    console.log(`\nNext: open Cursor in ${where} and run prompts/localize-cursor-os.md to adapt the OS to your project.`);
    console.log('Tip: with the Cursor CLI installed you can run it directly:');
    console.log('  cursor-agent -p "$(cat prompts/localize-cursor-os.md)"');
  }
}

function runDetect(args) {
  const result = detect({ target: args.target });
  if (args.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatDetectionText(result));
  }
}

function runDoctor(args) {
  const result = doctor({ target: args.target });
  const version = readVersion();
  console.log(`Cursor OS v${version} — doctor`);
  console.log(`Target: ${args.target}\n`);

  for (const { label, present, optional, note } of result.checks) {
    const symbol = present ? "ok     " : optional ? "pruned " : "MISSING";
    console.log(`  ${symbol}  ${label}`);
    if (note) console.log(`        note: ${note}`);
  }

  if (result.markerVersion && result.markerVersion !== version) {
    console.log(`\n  note: installed from cursor-os ${result.markerVersion}; current is ${version}.`);
    console.log("        Re-run init to add files introduced since, or init --update to also");
    console.log("        refresh kit files you have not edited.");
  }

  console.log("");
  if (result.missingRequired === 0 && result.todoCount === 0) {
    console.log("Cursor OS appears installed and localized.");
  } else if (result.missingRequired === 0) {
    console.log("Cursor OS is installed. Run prompts/localize-cursor-os.md to complete setup.");
  } else {
    console.log(`Cursor OS is not fully installed (${result.missingRequired} required file(s) missing). Run: cursor-os init`);
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
    } else if (args.command === "detect") {
      runDetect(args);
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
