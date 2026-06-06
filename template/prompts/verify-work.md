# Prompt: Verify work

**File:** `prompts/verify-work.md`

Paste this into Cursor to request an independent verification pass after a change is claimed complete. Delegates to the `verifier` agent.

---

Invoke the `verifier` agent to check the following claimed work. Do not take the claim at face value.

**What was claimed done:** <describe the change and its acceptance criteria>

## Verifier instructions

1. Identify precisely what was claimed done and what the acceptance criteria were.
2. Confirm the implementation exists and is wired in — not just that files were created.
3. Run the relevant checks: types, lint, tests, and any behavioral check available in this repo. Use the commands in `docs/repo-memory.md`. Report exact commands and real output.
4. Check the result against `docs/quality-rubric.md`.
5. Probe edge cases, error states, and failure modes a happy-path implementation would miss.

## Report

- **Verified** — what was checked and the evidence (commands + results) it passes.
- **Incomplete or broken** — claims that don't hold up, with specific failing evidence.
- **Untested** — anything that could not be verified and what's needed to verify it.

Be concrete. A test file existing is not proof tests pass. "It should work" is not verification. If a check cannot be run, mark it unverified — do not downgrade it to "probably okay."
