# Quality Rubric

The gate to check work against before claiming it is done. If an item fails, the work is not complete. Localization should tighten this with project-specific checks (exact test/lint/build commands, coverage bars, performance budgets).

## Correctness

- [ ] Meets the stated acceptance criteria — the actual request, not an adjacent one.
- [ ] Handles edge cases and invalid input, not just the happy path.
- [ ] Error and empty states are handled deliberately, not left to crash or silently swallow.

## Fit

- [ ] Reuses existing patterns, utilities, and conventions instead of inventing parallel ones.
- [ ] Changes are surgical and scoped to the task; no unrelated refactors mixed in.
- [ ] No new dependency added without clear justification.

## Maintainability

- [ ] The next developer can understand where the change lives and why.
- [ ] New abstractions are named clearly and have one responsibility.
- [ ] Complex decisions are recorded in `docs/decision-log.md`.

## Safety

- [ ] No secrets hardcoded or logged; config read from the project's existing mechanism.
- [ ] External input validated; authorization boundaries respected.
- [ ] User data kept out of logs, error messages, and client bundles.

## Verification

- [ ] Types, lint, and tests run and pass — with evidence, not assumption.
- [ ] Behavior checked the way a user would hit it (manual or automated).
- [ ] New logic has a test that would fail without the change, where practical.

## Communication

- [ ] Report covers what changed, how it was verified, and remaining risks.
- [ ] Project memory updated if a durable fact or notable decision changed.
