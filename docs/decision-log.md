# Decision Log — cursor-os (this repo)

Append-only record of notable decisions for the Cursor OS project itself. Newest first. (Not part of the installable template — `template/docs/decision-log.md` is what gets installed into user projects.)

## 2026-06-10 — v0.2.0 publishes manually; CI publishing with provenance deferred

- **Decision:** The first npm release is published manually by the maintainer (`npm publish` from a tagged, CI-green commit). Automated publishing from GitHub Actions with npm provenance/trusted publishing is deferred.
- **Context:** Provenance attestation requires publishing from CI with OIDC; setting that up needs npm-side trusted-publisher configuration that doesn't exist yet. Shipping v0.2.0 should not block on it.
- **Alternatives:** A release workflow gated on tags with `NPM_TOKEN` — rejected for now: a half-configured workflow that fails on first use is worse than a documented manual process. CI already verifies the exact tarball end-to-end on every push.
- **Consequences:** No provenance badge on the first release. Revisit before v0.3: configure npm trusted publishing and add a tag-triggered release workflow with `--provenance`.

## 2026-06-10 — Localization detection stays a placeholder-marker heuristic

- **Decision:** `doctor` detects unfinished localization by counting `\bTODO\b` matches in `AGENTS.md` and `docs/repo-memory.md`. Instructional prose in those template files must not contain the literal word "TODO", and the localization prompt instructs deleting the install-time notes when done.
- **Context:** The previous instructional text contained "TODO", making the "installed and localized" state unreachable.
- **Alternatives:** A structured flag (e.g. `localized: true` in the version marker) — rejected for now: it adds write-state the agent must remember to set, while the heuristic is self-healing and matches what users see in the files.
- **Consequences:** Template prose edits must avoid the bare word "TODO" outside real placeholders. The localized-success smoke test guards this.

## 2026-06-10 — Bare invocation prints help; a command is required

- **Decision:** `node scripts/init.mjs` (and post-publish `npx cursor-os`) with no arguments prints help and writes nothing. `init` must be explicit. Supplying arguments without a command is an error.
- **Context:** The CLI previously defaulted to `init` into the current directory, so an exploratory bare run wrote 19 files wherever the user happened to be.
- **Alternatives:** Keep default-to-init (friendlier for the documented happy path) — rejected: a default action that mutates the filesystem is the wrong failure mode for a tool about to be published to npm.
- **Consequences:** Breaking pre-publish CLI change; README, help text, smoke tests, and CHANGELOG updated together. `init` compensates with an automatic post-install health check so the explicit command costs nothing in guidance.

## 2026-06-10 — Upgrade semantics: skip-existing stays; doctor reports drift

- **Decision:** Re-running `init` over an existing install continues to only add missing files and refresh the version marker — never overwrite. `doctor` compares the marker version to the current package version and notes drift, recommending a re-run of `init`.
- **Context:** v0.2 will introduce new/changed template files; users need a signal without risking their localized content.
- **Alternatives:** A diff/merge upgrade mode — deferred: high complexity, and localized files cannot be machine-merged safely. May revisit with a three-way-merge or `--force-file` flag if real demand appears.
- **Consequences:** Users on old templates must consciously re-run `init`; changed (not just added) template files won't propagate. Documented in README.

## 2026-06-10 — Node.js floor raised to 20; CI tests 20/22 on Ubuntu and Windows

- **Decision:** `engines.node >= 20`. CI matrix: Node 20 and 22 × ubuntu-latest and windows-latest, plus a checks job (`node --check`, `package.json` parse, `npm pack --dry-run`).
- **Context:** Node 18 is end-of-life; CI previously tested only Node 20 on Ubuntu while claiming `>=18` support, and the release checklist's machine-checkable items weren't enforced.
- **Alternatives:** Keep `>=18` for reach — rejected: claiming support for an EOL version CI doesn't test is a promise the project can't keep.
- **Consequences:** Slightly narrower install base; honest support claims; checklist items can no longer be skipped by a human.

## 2026-06-10 — Localization is not auto-executed by the installer

- **Decision:** The installer never invokes an AI to localize. Instead, `init` ends with an automatic doctor pass (placeholder count + next step) and prints a Cursor CLI one-liner (`cursor-agent -p "$(cat prompts/localize-cursor-os.md)"`) as an opt-in tip.
- **Context:** Proposal to run localization automatically as part of `npx cursor-os init`.
- **Alternatives:** Shell out to `cursor-agent` when detected — rejected for v0.x: spends the user's tokens without consent, produces unreviewed edits, and adds an external dependency to a deliberately dependency-free script.
- **Consequences:** Setup remains two steps, but the second step is now printed at the exact moment it's needed. Revisit as an explicit `--localize` opt-in flag for v0.2+.
