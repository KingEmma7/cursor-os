# Quality Rubric

Gate to check before claiming any change is done. All items must pass with evidence.

## Correctness

- [ ] Meets the stated acceptance criteria — the actual request, not an adjacent one.
- [ ] Edge cases and invalid input handled, not just the happy path.
- [ ] Error and empty states are handled deliberately, not left to crash or swallow silently.

## Fit

- [ ] Reuses existing patterns and utilities; no parallel abstractions invented.
- [ ] Changes are surgical and scoped to the task; no unrelated refactors mixed in.
- [ ] Zero new dependencies added without explicit justification (this repo is zero-dep by design).

## Maintainability

- [ ] The next developer can understand where the change lives and why.
- [ ] New abstractions named clearly with one responsibility.
- [ ] Complex decisions recorded in `docs/decision-log.md`.

## Safety

- [ ] No-clobber invariant preserved: `install()` never overwrites existing user files.
- [ ] `template/` remains framework-neutral; no stack-specific content added.
- [ ] Template prose contains no bare "TODO" outside real placeholder markers.

## Verification (project-specific)

- [ ] `npm test` passes — `node scripts/smoke-test.mjs`, 126 checks minimum.
- [ ] `node --check scripts/init.mjs && node --check scripts/smoke-test.mjs` clean.
- [ ] `npm run pack:dry-run` exits 0 and file list matches `package.json#files`.
- [ ] `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` succeeds.
- [ ] If `template/` files changed: `EXPECTED` in `smoke-test.mjs`, `README.md`, and `CHANGELOG.md` updated together.
- [ ] If new template file added: `doctor` output reflects it (derived from `template/` at runtime).

## Communication

- [ ] Report covers what changed, how it was verified, and remaining risks.
- [ ] `docs/repo-memory.md` updated if a durable fact changed.
- [ ] `docs/decision-log.md` appended if a notable decision was made.
- [ ] `CHANGELOG.md` updated for any user-visible change.
