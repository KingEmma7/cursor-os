# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- CLI restructured with explicit `init` and `doctor` subcommands; bare invocation still defaults to `init`.
- CLI argument parsing hardened: unknown commands, unknown options, invalid `--target`, and `doctor --dry-run` now fail without writing files.
- `doctor` now checks the full installed template file set plus the version marker, not just core files.
- Smoke test updated for new prompt file names and extended with doctor and subprocess CLI tests (112 checks).
- `package.json` description updated; `examples/` and public-release docs added to published files list.
- `CONTRIBUTING.md` updated with prompt naming convention and test-sync guidance.
- `AGENTS.md` updated with `examples/` in the layout and prompt naming rule.
- README install and doctor examples now use explicit Cursor OS checkout and target-project paths.

### Not done yet

- npm publishing (`npx cursor-os init`) — planned for `v0.2`.

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
