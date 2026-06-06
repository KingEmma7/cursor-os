# Prompt: Plan a feature

**File:** `prompts/plan-feature.md`

Paste this into Cursor to turn a feature request into a scoped, reviewable plan *before* any code is written. Best run in Plan mode.

---

Plan the following change before implementing it. Do not write implementation code yet.

**Request:** <describe the feature or change>

## Inspect

- Read `AGENTS.md`, `docs/repo-memory.md`, `docs/architecture.md` (if present), and the `docs/decision-log.md` for anything relevant.
- Locate the code this change touches. Identify existing patterns, utilities, and conventions to reuse.

## Produce a plan

1. **Acceptance criteria** — restate the goal as concrete, testable outcomes. Note any assumptions and open questions explicitly.
2. **Approach** — the smallest complete design that fits the codebase. Call out reused patterns and any new abstraction or dependency (with justification).
3. **Files to change** — the specific files/modules and what changes in each.
4. **Risks and edge cases** — failure modes, data/auth/security implications, and edge cases to handle.
5. **Verification plan** — the exact checks you'll run to prove it works (tests, types, lint, manual QA).
6. **Phasing** — if the change is too large, split it into phases and recommend the safest first slice.

## Report

Output the plan and stop. Flag any conflict with the existing codebase or a logged decision now, before building. If requirements are ambiguous, ask rather than guess.
