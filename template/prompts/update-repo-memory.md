# Prompt: Update repo memory

**File:** `prompts/update-repo-memory.md`

Paste this into Cursor after a significant change to the project's structure, stack, or conventions. Keeps `docs/repo-memory.md` and related docs accurate.

---

Review and update `docs/repo-memory.md` (and related memory docs) to reflect the current state of this repository. Do not invent — only record facts you can verify from the actual code, config, and docs.

## Steps

1. **Inspect.** Read the current `docs/repo-memory.md` and compare each section against the actual repo: manifests, config files, CI, and top-level structure.

2. **Identify drift.** Note which facts are stale, missing, or have changed since the last update.

3. **Update.** Replace stale or missing content with verified facts. Leave a `TODO:` marker where the repo does not answer the question.

4. **Check related docs.** If `docs/architecture.md` or `docs/decision-log.md` exist, flag anything there that is now contradicted by current code or a more recent decision — but only update them if the correction is unambiguous.

5. **Do not touch application code.** Only memory docs are in scope.

## Report

- What you updated and why (what was stale or missing).
- What TODOs you left and what's needed to resolve them.
- Anything you recommend updating that was out of scope.
