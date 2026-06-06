# Prompt: Review a PR or change

**File:** `prompts/review-pr.md`

Paste this into Cursor to review a diff before it ships. For an independent pass, run the `verifier` agent alongside it.

---

Review the current changes (staged diff, branch diff, or the files I point you to) against this repo's standards. Be specific and skeptical; do not approve by default.

## Check against

- `AGENTS.md` — the engineering contract.
- `docs/quality-rubric.md` — the completion gate.
- `docs/architecture.md` and `docs/decision-log.md` — consistency with how this repo is built and decided.

## Look for

- **Correctness** — does it meet the intended acceptance criteria? Edge cases, error and empty states, and failure modes handled?
- **Fit** — reuses existing patterns; surgical and scoped; no unjustified dependency or parallel abstraction.
- **Safety** — no hardcoded/logged secrets; input validated; authorization respected; user data not leaked.
- **Verification** — is there evidence the checks (types, lint, tests) actually pass? Are new behaviors tested?
- **Scope creep** — unrelated changes mixed into the diff.
- **PR description gaps** — missing context, test plan, screenshots, migration notes, or rollout/rollback notes.

## Report

Group findings by severity:

- **Blocking** — must fix before merge, with the specific location and why.
- **Should fix** — important but not blocking.
- **Nits** — optional polish.

For each finding, point to the file/line and suggest the concrete fix. If something can't be verified from the diff alone, say what check is needed rather than assuming it passes.
