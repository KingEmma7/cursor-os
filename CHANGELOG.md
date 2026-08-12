# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-08-07

### Added

- Read-only `detect` command with deterministic text and versioned JSON output.
- Evidence-backed detection for languages, JavaScript frameworks, package managers,
  monorepo indicators, package scripts, common tooling, and Next.js/Supabase/Vercel
  localization presets.
- Programmatic `detect({ target })` export alongside `install` and `doctor`.
- Post-install project-signal summary that grounds the localization next step without
  modifying user files.
- Detection warnings for malformed `package.json` and competing package-manager
  lockfiles; neither condition prevents a partial report.
- Smoke coverage for programmatic and CLI detection, JSON parsing, read-only behavior,
  invalid formats, stack presets, malformed manifests, and post-install signals.
- `init --update`, which refreshes kit files that still match what a previous install
  wrote and leaves edited files alone. Backed by `.cursor/.cursor-os-manifest.json`,
  an install manifest recording a SHA-256 per file. Installs predating 0.3.0 have no
  manifest, so every differing file is treated as edited until the next `init` writes
  one.
- `install()` now classifies each file as `created`, `refreshed`, `skipped` (identical
  to the template), `stale` (unedited but behind the template), `customized` (edited
  and preserved), or `updated` (generated files).
- `doctor()` returns `missingRequired`, and each check carries an `optional` flag.
- Smoke suite expanded to 194 checks, covering pruned rules, target validation, update
  semantics, and OS artifacts in `template/`.

### Fixed

- `doctor` no longer reports a broken install when localization prunes the opt-in rules
  (`frontend.mdc`, `debugging.mdc`), which `prompts/localize-cursor-os.md` instructs it
  to do. They are listed as `pruned` and no longer cause a non-zero exit.
- `init` no longer creates a directory tree from a mistyped `--target`. It creates at
  most one new directory level and reports the missing parent otherwise.
- `doctor` and `detect` against a nonexistent directory now report that the directory is
  missing rather than that Cursor OS is not installed.
- `init` against a regular file fails with a clear message instead of a raw `ENOTDIR`.
- The installer no longer treats OS artifacts (`.DS_Store`, `Thumbs.db`, `desktop.ini`)
  as part of the kit. A stray `.DS_Store` in `template/` was copied into every install
  and broke three count-based smoke checks on macOS, where CI could not observe it.
- `template/.cursor/rules/frontend.mdc` declared `globs` as a YAML block sequence.
  Cursor's `.mdc` frontmatter is not strictly YAML and documents a comma-separated
  list, so the rule may not have attached. Now `globs: **/*.tsx,**/*.jsx,...`.
- Corrected bin entry in `package.json` via `npm pkg fix` (the hyphenated key `cursor-os`
  was auto-corrected during publish; this makes the source file match what npm holds).

### Changed

- `prompts/localize-cursor-os.md` now consumes `cursor-os detect --format json` as an
  optional evidence source, while requiring every signal to be verified against the
  repository before localization edits.

## [0.2.0] — 2026-06-10

First npm release: `npx cursor-os init`.

### Added

- `init` now runs a post-install health check automatically: it reports missing files, the remaining placeholder count, and the exact next step (including a Cursor CLI one-liner for running localization).
- `doctor` now reports version drift between the installed `.cursor/.cursor-os-version` marker and the current Cursor OS version, and suggests re-running `init` to pick up new files.
- Smoke tests for the localized success path ("installed and localized"), version-drift reporting, the post-install check, and the new bare-invocation behavior (126 checks).
- CI hardening: smoke tests run on Node 20 and 22 across Ubuntu and Windows; a separate job syntax-checks the scripts, validates `package.json` parses, and previews the npm package contents.
- `docs/decision-log.md` recording the CLI default, upgrade-semantics, Node-version, and localization-detection decisions.
- Programmatic API: `import { install, doctor } from "cursor-os"` now resolves via the package `exports` field.
- Runtime Node version guard: the CLI fails fast with a clear message on Node older than 20 (the `engines` field is advisory only).
- CI end-to-end packaging test: packs the tarball, installs it into a scratch project, and runs the `cursor-os` bin (`init`, `doctor`, bare help, and programmatic import).
- `.gitattributes` enforcing LF line endings — a CRLF shebang would break the published bin on Unix.
- `.gitignore` entry for `*.tgz` (local `npm pack` output).

### Changed (breaking, pre-publish)

- A command (`init` or `doctor`) is now required whenever arguments are given. Bare invocation with no arguments prints help and writes nothing — `npx cursor-os` will never modify the filesystem by accident. The previous default-to-`init` behavior (including `node scripts/init.mjs <dir>`) is removed; use `init <dir>` or `init --target <dir>`.
- Minimum supported Node.js version raised from 18 (end-of-life) to 20 (`engines` field).

### Fixed

- `doctor` could never report "installed and localized": the install-time instruction notes in `template/AGENTS.md` and `template/docs/repo-memory.md` contained the literal word "TODO", so the placeholder count never reached zero. The notes no longer use the word, and the localization prompt now instructs deleting them when done. Fresh-install placeholder counts changed from 5/12 to 4/10.
- CLI direct-invocation guard now realpath-normalizes both paths, so the CLI runs correctly when invoked through a symlinked path (e.g. macOS `/tmp` → `/private/tmp`).
- `listFiles` uses `lstat` so a symlinked directory inside `template/` can no longer cause infinite recursion.
- Removed an unused variable in the smoke test; hoisted the doctor placeholder-file list to a module constant.

- GitHub Actions smoke-test workflow.
- Pull request and issue templates for public contributions.
- README badges and unofficial-project disclaimer.
- `prompts/verify-work.md` — delegates an independent verification pass to the `verifier` agent.
- `prompts/update-repo-memory.md` — keeps memory docs current after significant project changes.
- `prompts/README.md` — explains when to use each prompt and the typical feature workflow.
- `examples/localization-example.md` — concrete before/after showing what localization means.
- CLI `doctor` subcommand: checks whether Cursor OS is installed and flags unfilled TODO placeholders.
- CLI `--version` / `-v` flag.
- `doctor` and `pack:dry-run` npm scripts in `package.json`.
- Public-release docs: `RELEASE_CHECKLIST.md`, `SECURITY.md`, `SUPPORT.md`, and `CODE_OF_CONDUCT.md`.

### Changed

- Renamed the project from **Cursor OS Starter** to **Cursor OS** (`cursor-os` on npm/GitHub).
- Repositioned docs and README to frame Cursor OS as an installable operating layer designed primarily for existing projects.
- Prompt files renamed from numbered names to descriptive command-style names:
  - `00-localize-cursor-os.md` → `prompts/localize-cursor-os.md`
  - `01-feature-planning.md` → `prompts/plan-feature.md`
  - `02-implementation.md` → `prompts/implement-change.md`
  - `03-debug-regression.md` → `prompts/debug-regression.md`
  - `04-pr-review.md` → `prompts/review-pr.md`
- All template references to numbered prompt filenames updated.
- CLI restructured with explicit `init` and `doctor` subcommands.
- CLI argument parsing hardened: unknown commands, unknown options, invalid `--target`, and `doctor --dry-run` now fail without writing files.
- `doctor` now checks the full installed template file set plus the version marker, not just core files.
- Smoke test updated for new prompt file names and extended with doctor and subprocess CLI tests.
- `package.json` description updated; `examples/` and public-release docs added to published files list.
- `CONTRIBUTING.md` updated with prompt naming convention and test-sync guidance.
- `AGENTS.md` updated with `examples/` in the layout and prompt naming rule.
- README install and doctor examples now use explicit Cursor OS checkout and target-project paths.

### Not done yet

- Interactive setup with project detection and stack presets (Next.js, Supabase, Vercel) — planned for a future release.

## [0.1.0] — 2026-06-02

### Added

- Portable engineering contract: root `AGENTS.md` and `template/AGENTS.md`.
- Cursor rules: `core.mdc` (always-on), `frontend.mdc`, `debugging.mdc`.
- Skills: `implementation-loop`, `debugging-loop`.
- Custom agent: `verifier` (read-only skeptical reviewer).
- Durable doc scaffolds: `repo-memory.md`, `quality-rubric.md`, `decision-log.md`.
- Prompts (original numbered names): `00-localize-cursor-os`, `01-feature-planning`,
  `02-implementation`, `03-debug-regression`, `04-pr-review`.
- Idempotent installer (`scripts/init.mjs`) with `--dry-run`, skip-existing
  behavior, and a version marker.
- Installer smoke test (`scripts/smoke-test.mjs`).
