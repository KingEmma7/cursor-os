# AGENTS.md

This file is the engineering contract for this repository. Cursor reads it automatically; other tools can use it as plain markdown project guidance. Keep it accurate as the project's source of truth for *how* work gets done here.

> After installing Cursor OS, run the localization prompt (`prompts/localize-cursor-os.md`) so the sections below describe *this* project specifically. Replace the placeholder markers with real details, then delete this note.

## Project context

<!-- Filled in during localization. Keep it short and true. -->

- **What this is:** TODO — one or two sentences on the product and who uses it.
- **Stack:** TODO — language(s), framework(s), data layer, deployment target.
- **How it's organized:** TODO — or point to `docs/architecture.md`.
- **Build / test / run commands:** TODO — the exact commands an agent should use.

## How to use this file

- Keep this file short.
- Put long project details in `docs/`.
- Update this when project-wide working agreements change.

## Engineering contract

### Think before coding

- For multi-file or risky changes, write a short plan before editing.
- Turn vague requests into explicit acceptance criteria. Surface conflicts with the existing codebase before building, not after.
- Don't silently assume unclear requirements — ask or state the assumption.

### Simplicity first

- Build the smallest complete solution that satisfies the goal.
- Reuse existing patterns and utilities before creating new abstractions.
- Don't add dependencies without clear justification. Avoid speculative future-proofing.

### Surgical changes

- Change only what the task requires. Don't refactor unrelated code in the same change.
- Every modified file should trace back to the request. Report unrelated issues separately instead of fixing them inline.

### Security and data

- Never hardcode or log secrets. Read configuration from the project's existing mechanism.
- Validate and sanitize external input. Respect authorization boundaries where they exist.
- Treat user data as sensitive: no leaking it into logs, errors, or client bundles.

### Verification before done

Before claiming work is complete, report:

- **What changed** and why.
- **How it was verified** — the checks you ran (types, lint, tests, manual QA) and their results.
- **Remaining risks** and recommended follow-ups.

Do not claim something passes without having run the check. Report the command and result.

## Project memory

- `docs/repo-memory.md` — durable facts about this repo the agent should keep current.
- `docs/quality-rubric.md` — the gate to check work against before finishing.
- `docs/decision-log.md` — append a short entry when you make a notable architectural decision.
