# Prompts

These prompts are **not** loaded automatically by Cursor. Paste the relevant prompt into Cursor chat when you want that workflow. Each prompt is designed to be used at a specific point in the development cycle.

## When to use each prompt

| Prompt | When to use |
| --- | --- |
| `prompts/localize-cursor-os.md` | **Once after install, and after major architectural changes.** Adapts the base OS to your actual project — fills in AGENTS.md, docs/repo-memory.md, and tunes the rules. Do not skip this step. |
| `prompts/plan-feature.md` | **Before writing any code for a non-trivial feature.** Produces a scoped plan with acceptance criteria, approach, file list, risks, and verification plan. |
| `prompts/implement-change.md` | **When executing an agreed plan.** Enforces discipline: surgical changes, evidence-based verification, and a written report. |
| `prompts/debug-regression.md` | **When something is broken and the root cause is unknown.** Forces root-cause isolation before any code changes. |
| `prompts/review-pr.md` | **Before merging a change.** Reviews the diff against the engineering contract and quality rubric. |
| `prompts/verify-work.md` | **After a change is claimed complete.** Delegates an independent verification pass to the `verifier` agent. Use on non-trivial changes. |
| `prompts/update-repo-memory.md` | **After significant structural or stack changes.** Keeps `docs/repo-memory.md` and related memory docs accurate. |

## How to use a prompt

1. Open Cursor chat (Agent mode).
2. Copy the contents of the prompt file.
3. Paste into the chat and fill in the placeholder (e.g., `<describe the feature>`).
4. Send.

## Typical flow for a new feature

```
plan-feature.md   →   implement-change.md   →   verify-work.md   →   review-pr.md
```

## Notes

- Prompts reference files by path (e.g., `prompts/plan-feature.md`), never by number. If Cursor uses numbered prompt labels, treat that as hallucination and refer to the file path instead.
- Prompts are framework-neutral. Localization tailors the OS to your stack; the prompts themselves stay generic.
- You can edit prompts to add project-specific context, but keep them focused on a single workflow step.
