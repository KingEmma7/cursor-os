// Read-only project detection for Cursor OS.
// Uses root manifests and configuration markers only: deterministic, fast,
// dependency-free, and safe to run before localization.

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const PACKAGE_MANAGER_MARKERS = [
  ["pnpm", "pnpm-lock.yaml"],
  ["yarn", "yarn.lock"],
  ["npm", "package-lock.json"],
  ["bun", "bun.lock"],
  ["bun", "bun.lockb"],
];

function isFile(target, rel) {
  try {
    return statSync(join(target, rel)).isFile();
  } catch {
    return false;
  }
}

function readJson(target, rel, warnings) {
  if (!isFile(target, rel)) return null;
  try {
    return JSON.parse(readFileSync(join(target, rel), "utf8"));
  } catch (error) {
    warnings.push(`${rel}: ${error.message}`);
    return null;
  }
}

function packageManagerName(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.split("@")[0] || null;
}

function sortedObject(value) {
  return Object.fromEntries(
    Object.entries(value ?? {})
      .filter(([, item]) => typeof item === "string")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Inspect a project without modifying it.
 *
 * The report is intentionally evidence-backed: signals come from root manifests,
 * dependency names, lockfiles and well-known configuration markers. Detection is
 * guidance for localization, not a substitute for reading the repository.
 */
export function detect({ target } = {}) {
  if (!target) throw new Error("detect() requires a target directory");
  const resolvedTarget = resolve(target);
  if (!existsSync(resolvedTarget)) {
    throw new Error(`target directory does not exist: ${resolvedTarget}`);
  }
  if (!statSync(resolvedTarget).isDirectory()) {
    throw new Error(`target is not a directory: ${resolvedTarget}`);
  }

  const warnings = [];
  const evidence = [];
  const packageJson = readJson(resolvedTarget, "package.json", warnings);
  const dependencies = new Set(
    [
      packageJson?.dependencies,
      packageJson?.devDependencies,
      packageJson?.peerDependencies,
      packageJson?.optionalDependencies,
    ].flatMap((group) => Object.keys(group ?? {})),
  );

  const addSignal = (list, value, source) => {
    if (!list.includes(value)) list.push(value);
    evidence.push({ signal: value, source });
  };

  const languages = [];
  const frameworks = [];
  const services = [];
  const tooling = [];
  const presets = [];

  if (packageJson) addSignal(languages, "JavaScript", "package.json");
  if (isFile(resolvedTarget, "tsconfig.json") || dependencies.has("typescript")) {
    addSignal(languages, "TypeScript", isFile(resolvedTarget, "tsconfig.json") ? "tsconfig.json" : "package.json:typescript");
  }
  if (isFile(resolvedTarget, "pyproject.toml") || isFile(resolvedTarget, "requirements.txt")) {
    addSignal(languages, "Python", isFile(resolvedTarget, "pyproject.toml") ? "pyproject.toml" : "requirements.txt");
  }
  if (isFile(resolvedTarget, "Cargo.toml")) addSignal(languages, "Rust", "Cargo.toml");
  if (isFile(resolvedTarget, "go.mod")) addSignal(languages, "Go", "go.mod");

  const dependencySignals = [
    ["next", frameworks, "Next.js", presets, "nextjs"],
    ["react", frameworks, "React"],
    ["vue", frameworks, "Vue"],
    ["nuxt", frameworks, "Nuxt"],
    ["svelte", frameworks, "Svelte"],
    ["@sveltejs/kit", frameworks, "SvelteKit"],
    ["astro", frameworks, "Astro"],
    ["@angular/core", frameworks, "Angular"],
    ["@supabase/supabase-js", services, "Supabase", presets, "supabase"],
    ["@supabase/ssr", services, "Supabase", presets, "supabase"],
    ["stripe", services, "Stripe"],
    ["@sentry/node", services, "Sentry"],
    ["@sentry/nextjs", services, "Sentry"],
    ["typescript", tooling, "TypeScript"],
    ["tailwindcss", tooling, "Tailwind CSS"],
    ["prisma", tooling, "Prisma"],
    ["drizzle-orm", tooling, "Drizzle ORM"],
    ["turbo", tooling, "Turborepo"],
    ["nx", tooling, "Nx"],
    ["storybook", tooling, "Storybook"],
    ["@storybook/react", tooling, "Storybook"],
    ["vitest", tooling, "Vitest"],
    ["jest", tooling, "Jest"],
    ["eslint", tooling, "ESLint"],
    ["@playwright/test", tooling, "Playwright"],
    ["cypress", tooling, "Cypress"],
  ];

  for (const [dependency, bucket, label, presetBucket, preset] of dependencySignals) {
    if (!dependencies.has(dependency)) continue;
    addSignal(bucket, label, `package.json:${dependency}`);
    if (presetBucket && preset && !presetBucket.includes(preset)) presetBucket.push(preset);
  }

  if (isFile(resolvedTarget, "supabase/config.toml")) {
    addSignal(services, "Supabase", "supabase/config.toml");
    if (!presets.includes("supabase")) presets.push("supabase");
  }
  if (
    isFile(resolvedTarget, "vercel.json") ||
    isFile(resolvedTarget, ".vercel/project.json") ||
    dependencies.has("vercel")
  ) {
    const source = isFile(resolvedTarget, "vercel.json")
      ? "vercel.json"
      : isFile(resolvedTarget, ".vercel/project.json")
        ? ".vercel/project.json"
        : "package.json:vercel";
    addSignal(services, "Vercel", source);
    if (!presets.includes("vercel")) presets.push("vercel");
  }
  for (const [rel, label] of [
    ["turbo.json", "Turborepo"],
    ["nx.json", "Nx"],
  ]) {
    if (isFile(resolvedTarget, rel)) addSignal(tooling, label, rel);
  }

  const lockfiles = PACKAGE_MANAGER_MARKERS.filter(([, rel]) => isFile(resolvedTarget, rel));
  const declaredPackageManager = packageManagerName(packageJson?.packageManager);
  const packageManager = declaredPackageManager ?? lockfiles[0]?.[0] ?? null;
  if (declaredPackageManager) {
    evidence.push({ signal: `package-manager:${declaredPackageManager}`, source: "package.json:packageManager" });
  } else if (lockfiles[0]) {
    evidence.push({ signal: `package-manager:${lockfiles[0][0]}`, source: lockfiles[0][1] });
  }
  if (lockfiles.length > 1) {
    warnings.push(`multiple package-manager lockfiles found: ${lockfiles.map(([, rel]) => rel).join(", ")}`);
  }

  const workspaceIndicators = [];
  const workspaces = packageJson?.workspaces;
  if (
    (Array.isArray(workspaces) && workspaces.length > 0) ||
    (workspaces && typeof workspaces === "object" && Object.keys(workspaces).length > 0)
  ) {
    workspaceIndicators.push("package.json:workspaces");
  }
  for (const rel of ["pnpm-workspace.yaml", "lerna.json"]) {
    if (isFile(resolvedTarget, rel)) workspaceIndicators.push(rel);
  }

  for (const values of [languages, frameworks, services, tooling, presets, workspaceIndicators]) {
    values.sort((left, right) => left.localeCompare(right));
  }
  evidence.sort((left, right) =>
    `${left.signal}\0${left.source}`.localeCompare(`${right.signal}\0${right.source}`),
  );
  warnings.sort((left, right) => left.localeCompare(right));

  return {
    schemaVersion: 1,
    target: resolvedTarget,
    project: {
      name: typeof packageJson?.name === "string" ? packageJson.name : basename(resolvedTarget),
      private: typeof packageJson?.private === "boolean" ? packageJson.private : null,
      packageManager,
    },
    languages,
    frameworks,
    services,
    tooling,
    presets,
    workspace: {
      monorepo: workspaceIndicators.length > 0,
      indicators: workspaceIndicators,
    },
    packageScripts: sortedObject(packageJson?.scripts),
    evidence,
    warnings,
  };
}

export function formatDetectionText(report) {
  const line = (label, values) => `${label}: ${values.length ? values.join(", ") : "none detected"}`;
  const output = [
    "Cursor OS — detect",
    `Target: ${report.target}`,
    `Project: ${report.project.name}`,
    `Package manager: ${report.project.packageManager ?? "not detected"}`,
    line("Languages", report.languages),
    line("Frameworks", report.frameworks),
    line("Services", report.services),
    line("Tooling", report.tooling),
    line("Localization presets", report.presets),
    `Workspace: ${report.workspace.monorepo ? `monorepo (${report.workspace.indicators.join(", ")})` : "single project or not detected"}`,
  ];

  const scripts = Object.entries(report.packageScripts);
  output.push("Package scripts:");
  if (scripts.length === 0) output.push("  none detected");
  for (const [name, command] of scripts) output.push(`  ${name}: ${command}`);

  if (report.warnings.length) {
    output.push("Warnings:");
    for (const warning of report.warnings) output.push(`  ${warning}`);
  }

  output.push("Read-only detection: no files were modified.");
  return output.join("\n");
}
