---
name: implementation-loop
description: Disciplined plan-build-verify loop for implementing a feature or change. Use when building something new or modifying existing behavior, especially across multiple files.
---

# Implementation Loop

A repeatable loop for shipping a change that actually works and fits the codebase. Follow the phases in order; don't skip to coding.

## 1. Understand

- Restate the goal as explicit acceptance criteria. If the request is vague, ask or state your assumption.
- Read the relevant code, `AGENTS.md`, and `docs/` (architecture, repo-memory, decision-log) before designing. Match existing patterns.
- Surface conflicts with the current codebase now, not after building.

## 2. Plan

- For multi-file or risky work, write a short plan: files to touch, the approach, and the verification you'll run.
- Choose the smallest complete solution. Reuse existing utilities and patterns before adding abstractions or dependencies.

## 3. Build

- Make surgical changes scoped to the goal. Don't refactor unrelated code in the same pass.
- Keep each modified file traceable to the request. Note unrelated issues separately instead of fixing them inline.

## 4. Verify

- Run the project's checks: types, lint, tests, and a manual check of the actual behavior. Don't assume — run them.
- Compare the result against `docs/quality-rubric.md`. Cover edge cases, error states, and the failure modes the change introduces.
- If checks cannot be run, explain exactly why and provide the safest manual verification path.

## 5. Report

- State what changed and why, how you verified it (commands and results), and any remaining risks or follow-ups.
- Update project memory: record durable facts in `docs/repo-memory.md` and append notable decisions to `docs/decision-log.md`.
