# Prompt: Debug a regression

**File:** `prompts/debug-regression.md`

Paste this into Cursor when something is broken and you need the root cause, not a patch. Pairs with the `debugging-loop` skill.

---

Debug the following using this repo's `debugging-loop` skill. Find the root cause before changing any code.

**Symptom:** <what's broken — error message, failing test, or wrong behavior>
**When it started / suspected trigger:** <if known>

## Investigate

1. **Reproduce** — establish exact repro steps and capture the full error/stack trace and expected-vs-actual behavior. If you can't reproduce it, gather more evidence before editing.
2. **Isolate** — read the failing path, form a specific hypothesis, and confirm it with evidence (targeted logging, a failing test, bisecting inputs, or recent diffs). Separate the symptom from the underlying cause.
3. **Fix** — change the root cause with the smallest viable edit. Don't mask it with broad try/catch, retries, or silenced output. Keep unrelated cleanup out.

## Verify

- Add or run a check that fails before the fix and passes after — a regression test where practical.
- Run the surrounding tests to confirm nothing adjacent broke.

## Report

- Root cause, with the evidence that proves it.
- The fix and why it's correct rather than a workaround.
- How you verified it.
- If this points to a recurring trap, note it in `docs/repo-memory.md`.
