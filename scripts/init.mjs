#!/usr/bin/env node
// Cursor OS installer.
// Copies the template kit without silently taking ownership of pre-existing files.
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
  renameSync,
  rmSync,
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
const MANIFEST_SCHEMA = 1;
const SHA256_RE = /^[a-f0-9]{64}$/;
const TODO_FILES = ["AGENTS.md", join("docs", "repo-memory.md")];
const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".AppleDouble"]);
const OPTIONAL_FILES = new Set([
  join(".cursor", "rules", "frontend.mdc"),
  join(".cursor", "rules", "debugging.mdc"),
]);

function manifestKey(rel) {
  return rel.split(sep).join("/");
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pathKind(path) {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return "symlink";
    if (stat.isFile()) return "file";
    if (stat.isDirectory()) return "directory";
    return "other";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

function readManifestState(target) {
  const path = join(target, MANIFEST_REL);
  const kind = pathKind(path);
  if (kind === "missing") return { status: "missing", manifest: null, error: null };
  if (kind !== "file") {
    return { status: "invalid", manifest: null, error: `${MANIFEST_REL} is not a regular file` };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || parsed.schemaVersion !== MANIFEST_SCHEMA) {
      return {
        status: "invalid",
        manifest: null,
        error: `${MANIFEST_REL} uses unsupported schema ${parsed?.schemaVersion ?? "unknown"}; expected ${MANIFEST_SCHEMA}`,
      };
    }
    if (!parsed.files || typeof parsed.files !== "object" || Array.isArray(parsed.files)) {
      return { status: "invalid", manifest: null, error: `${MANIFEST_REL} has an invalid files map` };
    }
    for (const [key, hash] of Object.entries(parsed.files)) {
      if (typeof hash !== "string" || !SHA256_RE.test(hash)) {
        return { status: "invalid", manifest: null, error: `${MANIFEST_REL} has an invalid hash for ${key}` };
      }
    }
    const pruned = Array.isArray(parsed.pruned) ? parsed.pruned : [];
    if (!pruned.every((key) => typeof key === "string")) {
      return { status: "invalid", manifest: null, error: `${MANIFEST_REL} has an invalid pruned list` };
    }
    return {
      status: "valid",
      manifest: {
        schemaVersion: MANIFEST_SCHEMA,
        version: typeof parsed.version === "string" ? parsed.version : null,
        files: { ...parsed.files },
        pruned: [...new Set(pruned)].sort(),
      },
      error: null,
    };
  } catch (error) {
    return { status: "invalid", manifest: null, error: `${MANIFEST_REL} is unreadable: ${error.message}` };
  }
}

function writeManifestAtomic(target, manifest) {
  const dest = join(target, MANIFEST_REL);
  const temp = `${dest}.tmp-${process.pid}`;
  mkdirSync(dirname(dest), { recursive: true });
  try {
    writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    renameSync(temp, dest);
  } finally {
    rmSync(temp, { force: true });
  }
}

function assertUsableTarget(target, { allowCreate = false } = {}) {
  const resolved = resolve(target);
  if (existsSync(resolved)) {
    if (!statSync(resolved).isDirectory()) throw new Error(`target is not a directory: ${resolved}`);
    return resolved;
  }
  if (!allowCreate) {
    throw new Error(`target directory does not exist: ${resolved}\n       Check the path, or run init there first.`);
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
    return JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--version" || a === "-v") args.version = true;
    else if (a === "--dry-run" || a === "-n") args.dryRun = true;
    else if (a === "--update" || a === "-u") args.update = true;
    else if (a === "--format") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) args.errors.push("--format requires text or json");
      else if (value !== "text" && value !== "json") {
        args.errors.push(`unsupported format: ${value}`);
        i++;
      } else {
        args.format = value;
        formatSet = true;
        i++;
      }
    } else if (a === "--target" || a === "-t") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) args.errors.push(`${a} requires a directory value`);
      else {
        args.target = value;
        targetSet = true;
        i++;
      }
    } else if ((a === "init" || a === "doctor" || a === "detect") && args.command === null) {
      args.command = a;
    } else if (a.startsWith("-")) args.errors.push(`unknown option: ${a}`);
    else if (!targetSet) {
      args.target = a;
      targetSet = true;
    } else args.errors.push(`unexpected argument: ${a}`);
  }

  if (args.command === null && !args.help && !args.version && !args.bare) {
    args.errors.push("missing command: specify 'init', 'doctor' or 'detect'");
  }
  if (args.command !== "init" && args.dryRun) args.errors.push("--dry-run is only valid with init");
  if (args.command !== "init" && args.update) args.errors.push("--update is only valid with init");
  if (args.command !== "detect" && formatSet) args.errors.push("--format is only valid with detect");
  return args;
}

const HELP = `Cursor OS — installer

Usage:
  cursor-os <command> [target] [options]

Commands:
  init      Install Cursor OS into the target directory
  doctor    Check install, localization, ownership and update health
  detect    Read project manifests and report stack signals (never writes)

Arguments:
  target    Directory to operate on (default: current directory)

Options:
  -n, --dry-run     Preview changes without writing anything (init only)
  -u, --update      Refresh only managed files Cursor OS can prove are unedited
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
  doctor and detect require an existing target. init may create one final directory
  level when its parent exists; it will not fabricate a missing directory tree.
  For a target directory named "init", "doctor" or "detect", or one starting with "-",
  use the intended command with the explicit form: <command> --target <dir>.
  When running from a local checkout: node scripts/init.mjs <command>

The installer copies AGENTS.md, .cursor/, docs/, and prompts/ into the target.
Pre-existing files remain unmanaged and are never silently adopted. --update only
refreshes files recorded as managed and still byte-identical to what Cursor OS last
wrote. Optional rules deleted during localization remain pruned.
After installing, open Cursor and run prompts/localize-cursor-os.md.`;

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    if (lstatSync(full).isDirectory()) {
      for (const child of listFiles(full)) out.push(join(entry, child));
    } else out.push(entry);
  }
  return out;
}

/**
 * Plan and apply installation changes.
 * manifest.files is an ownership ledger: only paths Cursor OS actually wrote are
 * recorded. Existing files are deliberately never adopted.
 */
export function install({ target, dryRun = false, update = false } = {}) {
  if (!target) throw new Error("install() requires a target directory");
  if (!existsSync(templateDir)) throw new Error(`template directory not found at ${templateDir}`);
  assertUsableTarget(target, { allowCreate: true });

  const version = readVersion();
  const manifestState = readManifestState(target);
  if (manifestState.status === "invalid") {
    throw new Error(
      `${manifestState.error}. Refusing to change ownership state. Inspect or remove the manifest, then run plain init; existing files will remain unmanaged.`,
    );
  }

  const priorFiles = manifestState.manifest?.files ?? {};
  const priorPruned = new Set(manifestState.manifest?.pruned ?? []);
  const nextFiles = {};
  const nextPruned = new Set();
  const templateFiles = listFiles(templateDir).sort();
  const templateKeys = new Set(templateFiles.map(manifestKey));
  const result = {
    created: [], restored: [], refreshed: [], skipped: [], stale: [], customized: [],
    unmanaged: [], pruned: [], obsolete: [], removed: [], conflicts: [], updated: [],
    target, dryRun, update, version, manifestStatus: manifestState.status,
  };

  for (const rel of templateFiles) {
    const src = join(templateDir, rel);
    const dest = join(target, rel);
    const key = manifestKey(rel);
    const templateHash = hashFile(src);
    const recordedHash = priorFiles[key] ?? null;
    const wasPruned = priorPruned.has(key);
    const kind = pathKind(dest);

    if (kind === "missing") {
      if (wasPruned || (recordedHash !== null && OPTIONAL_FILES.has(rel))) {
        result.pruned.push(rel);
        nextPruned.add(key);
        continue;
      }
      if (!dryRun) {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      }
      (recordedHash !== null ? result.restored : result.created).push(rel);
      nextFiles[key] = templateHash;
      continue;
    }

    if (kind !== "file") {
      result.conflicts.push({ rel, kind });
      if (recordedHash !== null) nextFiles[key] = recordedHash;
      if (wasPruned) nextPruned.add(key);
      continue;
    }

    const currentHash = hashFile(dest);
    if (recordedHash !== null) {
      if (currentHash === recordedHash) {
        if (currentHash === templateHash) {
          result.skipped.push(rel);
          nextFiles[key] = templateHash;
        } else if (update) {
          if (!dryRun) copyFileSync(src, dest);
          result.refreshed.push(rel);
          nextFiles[key] = templateHash;
        } else {
          result.stale.push(rel);
          nextFiles[key] = recordedHash;
        }
      } else {
        result.customized.push(rel);
        nextFiles[key] = recordedHash;
      }
      continue;
    }

    result.customized.push(rel);
    result.unmanaged.push(rel);
  }

  for (const key of priorPruned) {
    if (!templateKeys.has(key)) continue;
    const rel = key.split("/").join(sep);
    if (pathKind(join(target, rel)) === "missing") nextPruned.add(key);
  }

  for (const [key, recordedHash] of Object.entries(priorFiles)) {
    if (templateKeys.has(key)) continue;
    const rel = key.split("/").join(sep);
    const dest = join(target, rel);
    const kind = pathKind(dest);
    if (kind === "missing") continue;
    if (kind !== "file") {
      result.conflicts.push({ rel, kind });
      nextFiles[key] = recordedHash;
      continue;
    }
    if (hashFile(dest) !== recordedHash) {
      result.customized.push(rel);
      nextFiles[key] = recordedHash;
      continue;
    }
    if (update) {
      if (!dryRun) rmSync(dest);
      result.removed.push(rel);
    } else {
      result.obsolete.push(rel);
      nextFiles[key] = recordedHash;
    }
  }

  const markerDest = join(target, MARKER_REL);
  const markerKind = pathKind(markerDest);
  if (markerKind !== "missing" && markerKind !== "file") {
    result.conflicts.push({ rel: MARKER_REL, kind: markerKind });
  } else if (markerKind === "file") {
    if (!dryRun) writeFileSync(markerDest, `cursor-os ${version}\n`, "utf8");
    result.updated.push(MARKER_REL);
  } else {
    if (!dryRun) {
      mkdirSync(dirname(markerDest), { recursive: true });
      writeFileSync(markerDest, `cursor-os ${version}\n`, "utf8");
    }
    result.created.push(MARKER_REL);
  }

  const manifestExisted = manifestState.status === "valid";
  if (!dryRun) {
    writeManifestAtomic(target, {
      schemaVersion: MANIFEST_SCHEMA,
      version,
      files: nextFiles,
      pruned: [...nextPruned].sort(),
    });
  }
  (manifestExisted ? result.updated : result.created).push(MANIFEST_REL);
  return result;
}

function doctorChecks() {
  if (!existsSync(templateDir)) throw new Error(`template directory not found at ${templateDir}`);
  return [
    ...listFiles(templateDir).sort().map((rel) => ({ rel, label: rel })),
    { rel: MARKER_REL, label: MARKER_REL, generated: true },
  ];
}

function readMarkerVersion(target) {
  try {
    return readFileSync(join(target, MARKER_REL), "utf8").match(/cursor-os (\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function doctor({ target } = {}) {
  if (!target) throw new Error("doctor() requires a target directory");
  assertUsableTarget(target);
  const manifestState = readManifestState(target);
  const manifest = manifestState.manifest;
  const owned = manifest?.files ?? {};
  const prunedKeys = new Set(manifest?.pruned ?? []);

  const checks = doctorChecks().map(({ rel, label, generated = false }) => {
    const fullPath = join(target, rel);
    const kind = pathKind(fullPath);
    const present = kind === "file";
    const optional = !generated && OPTIONAL_FILES.has(rel);
    const key = manifestKey(rel);
    const recordedHash = generated ? null : owned[key] ?? null;
    const managed = recordedHash !== null;
    const pruned = !present && optional && (managed || prunedKeys.has(key));
    const conflict = kind !== "file" && kind !== "missing";
    let note = null;
    let todoCount = 0;
    let stale = false;
    let customized = false;
    let unmanaged = false;

    if (present && TODO_FILES.includes(rel)) {
      const content = readFileSync(fullPath, "utf8");
      todoCount = (content.match(/\bTODO\b/g) ?? []).length;
      if (todoCount > 0) note = `${todoCount} TODO placeholder(s) remain — run prompts/localize-cursor-os.md`;
    }

    if (conflict) note = `${kind} at an installer path; Cursor OS will not follow or replace it`;
    else if (!present && optional) {
      note = pruned
        ? "optional rule intentionally absent; future init/update will preserve pruning"
        : "optional rule absent";
    } else if (present && managed) {
      const currentHash = hashFile(fullPath);
      const templateHash = hashFile(join(templateDir, rel));
      customized = currentHash !== recordedHash;
      stale = !customized && currentHash !== templateHash;
      if (stale) note = "managed file is behind the current template; run init --update";
      else if (customized) note = "managed file has local edits; update will preserve it";
    } else if (present && !managed && !generated) {
      unmanaged = true;
      if (!note) note = "pre-existing/unmanaged file; Cursor OS will never overwrite it";
    }

    return { label, present, optional, managed, pruned, conflict, kind, stale, customized, unmanaged, note, todoCount };
  });

  const currentKeys = new Set(listFiles(templateDir).map(manifestKey));
  const obsolete = [];
  for (const [key, recordedHash] of Object.entries(owned)) {
    if (currentKeys.has(key)) continue;
    const rel = key.split("/").join(sep);
    const dest = join(target, rel);
    const kind = pathKind(dest);
    if (kind === "missing") continue;
    obsolete.push({ rel, kind, customized: kind === "file" && hashFile(dest) !== recordedHash });
  }

  const todoCount = checks.reduce((n, c) => n + c.todoCount, 0);
  const missingRequired = checks.filter((c) => !c.present && !c.optional && !c.conflict).length;
  const conflicts = checks.filter((c) => c.conflict).length;
  const staleManaged = checks.filter((c) => c.stale).length;
  const customizedManaged = checks.filter((c) => c.customized).length;
  const unmanaged = checks.filter((c) => c.unmanaged).length;
  return {
    checks, todoCount, missingRequired, conflicts, staleManaged, customizedManaged, unmanaged, obsolete,
    manifestStatus: manifestState.status,
    manifestError: manifestState.error,
    updateSafe: manifestState.status === "valid",
    manifestVersion: manifest?.version ?? null,
    markerVersion: readMarkerVersion(target),
    target,
  };
}

function runInit(args) {
  const result = install(args);
  console.log(`Cursor OS v${result.version}${args.dryRun ? " (dry run)" : ""}`);
  console.log(`Target: ${args.target}\n`);
  const verb = args.dryRun ? "Would create" : "Created";
  if (result.created.length) {
    console.log(`${verb} ${result.created.length} file(s):`);
    for (const f of result.created) console.log(`  + ${f}`);
  }
  if (result.restored.length) {
    console.log(`\n${args.dryRun ? "Would restore" : "Restored"} ${result.restored.length} missing managed file(s):`);
    for (const f of result.restored) console.log(`  + ${f}`);
  }
  if (result.refreshed.length) {
    console.log(`\n${args.dryRun ? "Would refresh" : "Refreshed"} ${result.refreshed.length} unedited managed file(s):`);
    for (const f of result.refreshed) console.log(`  ^ ${f}`);
  }
  if (result.skipped.length) {
    console.log(`\nSkipped ${result.skipped.length} up-to-date managed file(s):`);
    for (const f of result.skipped) console.log(`  = ${f}`);
  }
  if (result.stale.length) {
    console.log(`\n${result.stale.length} managed file(s) are behind the current template:`);
    for (const f of result.stale) console.log(`  ! ${f}`);
    console.log("  Run init --update to refresh them.");
  }
  if (result.customized.length) {
    console.log(`\nKept ${result.customized.length} customized/unmanaged file(s):`);
    for (const f of result.customized) console.log(`  * ${f}`);
  }
  if (result.unmanaged.length) {
    console.log(`  ${result.unmanaged.length} of these are pre-existing and not owned by Cursor OS.`);
  }
  if (result.pruned.length) {
    console.log(`\nPreserved ${result.pruned.length} pruned optional rule(s):`);
    for (const f of result.pruned) console.log(`  - ${f}`);
  }
  if (result.obsolete.length) {
    console.log(`\n${result.obsolete.length} unchanged managed file(s) are no longer in the template:`);
    for (const f of result.obsolete) console.log(`  o ${f}`);
    console.log("  Run init --update to remove them safely.");
  }
  if (result.removed.length) {
    console.log(`\n${args.dryRun ? "Would remove" : "Removed"} ${result.removed.length} obsolete managed file(s):`);
    for (const f of result.removed) console.log(`  x ${f}`);
  }
  if (result.conflicts.length) {
    console.log(`\nSkipped ${result.conflicts.length} filesystem conflict(s):`);
    for (const { rel, kind } of result.conflicts) console.log(`  ? ${rel} (${kind})`);
    console.log("  Symlinks and non-regular files are never followed or replaced.");
  }
  if (result.updated.length) {
    console.log(`\n${args.dryRun ? "Would refresh" : "Refreshed"} ${result.updated.length} generated file(s):`);
    for (const f of result.updated) console.log(`  ~ ${f}`);
  }
  if (args.dryRun) {
    console.log("\nDry run complete — no files were written.");
    return;
  }

  const health = doctor({ target: args.target });
  const rel = relative(repoRoot, args.target);
  let where = rel || "this repo";
  if (rel.startsWith("..")) where = resolve(args.target);
  console.log("\nPost-install check:");
  if (health.missingRequired > 0 || health.conflicts > 0) {
    console.log(`  ${health.missingRequired} required file(s) missing; ${health.conflicts} conflict(s). Run cursor-os doctor.`);
  } else if (health.staleManaged > 0) {
    console.log(`  Installed with ${health.staleManaged} managed file(s) behind the current template.`);
  } else if (health.todoCount > 0) {
    console.log(`  All required files installed. ${health.todoCount} placeholder(s) await localization.`);
  } else console.log("  All required files installed and localized.");

  if (health.todoCount > 0) {
    const project = detect({ target: args.target });
    const signals = [...project.frameworks, ...project.services, ...project.tooling].slice(0, 8);
    if (signals.length > 0) console.log(`\nDetected project signals: ${signals.join(", ")}`);
    console.log(`\nNext: open Cursor in ${where} and run prompts/localize-cursor-os.md to adapt the OS to your project.`);
    console.log("Tip: with the Cursor CLI installed you can run it directly:");
    console.log('  agent -p "$(cat prompts/localize-cursor-os.md)"');
  }
}

function runDetect(args) {
  const result = detect({ target: args.target });
  if (args.format === "json") console.log(JSON.stringify(result, null, 2));
  else console.log(formatDetectionText(result));
}

function runDoctor(args) {
  const result = doctor({ target: args.target });
  const version = readVersion();
  console.log(`Cursor OS v${version} — doctor`);
  console.log(`Target: ${args.target}\n`);
  for (const check of result.checks) {
    let symbol = "ok       ";
    if (check.conflict) symbol = "CONFLICT ";
    else if (!check.present && check.optional) symbol = check.pruned ? "pruned   " : "optional ";
    else if (!check.present) symbol = "MISSING  ";
    else if (check.stale) symbol = "stale    ";
    else if (check.customized) symbol = "custom   ";
    else if (check.unmanaged) symbol = "unmanaged";
    console.log(`  ${symbol}  ${check.label}`);
    if (check.note) console.log(`           note: ${check.note}`);
  }

  console.log("");
  if (result.manifestStatus === "invalid") {
    console.log(`  MANIFEST INVALID: ${result.manifestError}`);
    console.log("  init/update will refuse to change ownership state until this is resolved.");
  } else if (result.manifestStatus === "missing") {
    console.log("  note: no ownership manifest. Existing files are unmanaged; safe auto-update is unavailable for them.");
  }
  if (result.staleManaged > 0) console.log(`  note: ${result.staleManaged} managed file(s) can be refreshed with init --update.`);
  if (result.obsolete.length > 0) console.log(`  note: ${result.obsolete.length} managed path(s) are no longer in the template.`);
  if (result.markerVersion && result.markerVersion !== version) {
    console.log(`  note: installed from cursor-os ${result.markerVersion}; current is ${version}.`);
  }

  console.log("");
  const broken = result.missingRequired > 0 || result.conflicts > 0 || result.manifestStatus === "invalid";
  if (broken) {
    console.log(`Cursor OS is not fully installed (${result.missingRequired} required file(s) missing, ${result.conflicts} conflict(s)). Run: cursor-os init`);
    process.exitCode = 1;
  } else if (result.todoCount > 0) {
    console.log("Cursor OS is installed. Run prompts/localize-cursor-os.md to complete setup.");
  } else if (result.staleManaged > 0 || result.obsolete.length > 0) {
    console.log("Cursor OS is installed and localized; a safe template update is available.");
  } else console.log("Cursor OS appears installed and localized.");
}

const MIN_NODE_MAJOR = 20;
function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < MIN_NODE_MAJOR) {
    console.error(`Error: cursor-os requires Node.js ${MIN_NODE_MAJOR} or newer (you are running ${process.versions.node}).`);
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
  if (args.version) return void console.log(readVersion());
  if (args.help || args.bare) return void console.log(HELP);
  try {
    if (args.command === "doctor") runDoctor(args);
    else if (args.command === "detect") runDetect(args);
    else runInit(args);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isDirectInvocation()) main();
