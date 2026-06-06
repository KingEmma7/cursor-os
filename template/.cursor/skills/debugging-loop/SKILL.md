---
name: debugging-loop
description: Systematic reproduce-isolate-fix-verify loop for bugs, test failures, and unexpected behavior. Use when something is broken and the cause is not yet known.
---

# Debugging Loop

Find the root cause before changing code. Resist the urge to guess-and-patch.

## 1. Reproduce

- Establish exact, reliable repro steps. Capture the full error, stack trace, and the expected-vs-actual behavior.
- If you can't reproduce it, gather more evidence (logs, inputs, environment) before proceeding.

## 2. Isolate

- Read the failing code path and form a specific hypothesis about the cause.
- Narrow the surface: bisect inputs, add targeted logging or a failing test, or check recent changes. Confirm the hypothesis with evidence before editing.
- Distinguish the symptom from the cause. The first error in the chain is often not the real one.

## 3. Fix

- Change the root cause, not the symptom. Don't mask it with broad try/catch, retries, or silenced output.
- Make the smallest fix that resolves it. Keep unrelated cleanup out of the bugfix.

## 4. Verify

- Add or run a check that fails before the fix and passes after — a regression test where practical.
- Run the surrounding tests and confirm the fix didn't break adjacent behavior.

## 5. Capture

- Report the root cause, the evidence, the fix, and how you verified it.
- If this bug points to a recurring trap, record it in `docs/repo-memory.md` so it doesn't bite again.
