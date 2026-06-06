# Prompt: Implement a change

**File:** `prompts/implement-change.md`

Paste this into Cursor to implement an agreed plan with discipline. Pairs with the `implementation-loop` skill.

---

Implement the following, following this repo's `AGENTS.md` and the `implementation-loop` skill.

**What to build:** <the feature, or a link/reference to the plan from prompts/plan-feature.md>

## Build

- Make surgical changes scoped to the goal. Reuse existing patterns and utilities before adding new ones.
- Don't refactor unrelated code or add dependencies without justification. Keep every modified file traceable to the request.
- Handle edge cases, error states, and the failure modes this change introduces.

## Verify (required before you claim done)

- Run the project's checks: types, lint, tests, and a real behavioral check. Use the commands in `docs/repo-memory.md`.
- Check the result against `docs/quality-rubric.md`.
- Don't assert anything passes without running it. Show the checks you ran.

## Report

- What changed and why.
- How you verified it — commands run and their actual results.
- Remaining risks and recommended follow-ups.
- Update `docs/repo-memory.md` / `docs/decision-log.md` if a durable fact or notable decision changed.

When the change is non-trivial, consider invoking the `verifier` agent for an independent check before handing it back.
