# Repo Memory

Durable facts about this repository. Keep it short, current, and true — stale memory is worse than none.

## What this project is

Cursor OS: an installable operating layer that makes Cursor project-aware. Developers run the installer into any repo, then run the localization prompt once in Cursor to fill in project-specific context. Published as an npm package (`cursor-os`), pre-release at v0.1.0.

## Stack and key dependencies

- **Language:** Node.js ESM (`.mjs`), zero runtime or dev dependencies by design
- **Minimum Node:** 20 (enforced in `package.json` `engines`)
- **Product:** `template/` (the installable kit) + `scripts/` (installer CLI)
- **No build step:** scripts run directly with `node`

## How it's organised

```
template/          The kit installed into user projects (AGENTS.md, rules, skills, agents, docs, prompts)
scripts/           init.mjs (installer + library) and smoke-test.mjs (127-check test suite)
examples/          Before/after localization walkthrough
docs/              This repo's own decision log (not installed into user projects)
.cursor/           cursor-os installed on itself (dogfooded)
```

## Commands that matter

- Install: none (zero dependencies)
- Test: `npm test`
- Lint / syntax-check: `node --check scripts/init.mjs && node --check scripts/smoke-test.mjs`
- Pack preview: `npm run pack:dry-run`
- Dry-run install: `node scripts/init.mjs init --dry-run`
- Health check: `node scripts/init.mjs doctor`
- Build: none (no compile step)

## Conventions and gotchas

- **Zero deps, always.** The installer must stay dependency-free (Node built-ins only). No devDependencies without a very strong reason.
- **Template files are framework-neutral.** No stack presets in `template/`; all project-specific content is generated during localization.
- **No-clobber invariant.** `install()` never overwrites existing files. Every test that touches this path must preserve it.
- **Idempotency.** Re-running `init` is always safe. Smoke tests verify second-run behaviour.
- **EXPECTED list in smoke-test.mjs must stay in sync with template/.** When you add or remove a template file, update `EXPECTED` in `scripts/smoke-test.mjs`, `README.md`, and `CHANGELOG.md` together.
- **Prompt files referenced by full path, never by number.** e.g. `prompts/plan-feature.md` not "prompt 1".
- **Template prose must not contain the bare placeholder marker word outside real placeholders.** Instructional notes use alternative phrasing. This is what lets `doctor` reach its "installed and localized" success state.
- **`docs/decision-log.md` at repo root** is this project's own decision record and is NOT the same as `template/docs/decision-log.md` (the blank one that gets installed into user projects).

## Known constraints

- Installer must remain dependency-free (`SECURITY.md:41`, root `AGENTS.md`)
- Must never overwrite user files (core safety promise; most-tested behaviour in smoke suite)
- Template must remain framework-neutral (no stack presets)
- Bare `npx cursor-os` must never write files — command required
- Node ≥ 20 required; no Node 18 support (EOL, decision logged 2026-06-10)

## Recently learned facts

- 2026-06-10 — `doctor`'s success state required rewriting template instruction notes so placeholder markers only appear as real placeholders. Fixed in audit remediation; the smoke test pins this.
- 2026-06-10 — `listFiles` used `statSync` (follows symlinks); swapped to `lstatSync` to prevent cycle risk.
- 2026-06-10 — CLI previously defaulted to `init`; now bare invocation prints help (breaking pre-publish, safe decision).
