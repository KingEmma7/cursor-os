# AGENTS.md — cursor-os

This repository ships Cursor OS — an installable operating layer that makes Cursor project-aware. It dogfoods its own contract: the rules below govern work in *this* repo.

## What this project is

- An installable operating layer, not a framework. Keep the file set small and purposeful.
- The core promise: make Cursor project-aware by installing a contract, rules, memory docs, and prompts.
- The two highest-value assets are `template/AGENTS.md` (the portable engineering contract) and `template/prompts/localize-cursor-os.md` (the localization prompt).
- Prefer practical, repo-specific guidance over generic process text.

## Repository layout

- `template/` — the kit that gets copied into other projects. Never assume a specific stack here.
- `scripts/` — the installer (`init.mjs`) and its smoke test. Node built-ins only; no dependencies.
- `examples/` — concrete examples showing what localization looks like.
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` — public-facing docs.

## Working agreements

- Keep template files framework-neutral. Stack-specific guidance is generated during localization, not shipped as blanks.
- The installer must stay dependency-free and idempotent: never overwrite a user's existing files.
- Do not refer to prompts by number or sequence. Always use the full file path (e.g., `prompts/plan-feature.md`).
- When you change the template's file set, update `README.md`, `CHANGELOG.md`, and the installer's EXPECTED list in `scripts/smoke-test.mjs` together.
- Validate `package.json` parses and run `npm test` (the smoke test) before claiming the installer works.

## Verification before done

Report what changed, why, how it was verified, and any remaining risks.
