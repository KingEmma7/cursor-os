# Localization example

This example shows what Cursor OS looks like before installation, after installing the base OS, and after running the localization prompt. The project used here is a hypothetical task-management API built with Node.js and PostgreSQL.

---

## Stage 1: Before installing Cursor OS

The project exists, but Cursor has no project context. Every session starts from zero.

**Typical interaction:**

> "Add an endpoint to archive a task."

Cursor guesses at the routing style, invents an ORM method that doesn't match what the project uses, and skips authentication middleware that every other endpoint uses. You spend 20 minutes correcting it and re-explaining your patterns.

---

## Stage 2: After installing the base OS

You run:

```bash
node ../cursor-os/scripts/init.mjs init
```

The following files are now in the project root:

```
AGENTS.md                        ← filled with TODO placeholders
.cursor/rules/core.mdc           ← always-on engineering contract reference
.cursor/rules/frontend.mdc       ← opt-in (will be deleted during localization)
.cursor/rules/debugging.mdc      ← opt-in debugging discipline
.cursor/skills/implementation-loop/SKILL.md
.cursor/skills/debugging-loop/SKILL.md
.cursor/agents/verifier.md
docs/repo-memory.md              ← filled with TODO placeholders
docs/quality-rubric.md
docs/decision-log.md
prompts/localize-cursor-os.md    ← the localization prompt
prompts/plan-feature.md
prompts/implement-change.md
prompts/debug-regression.md
prompts/review-pr.md
prompts/verify-work.md
prompts/update-repo-memory.md
```

At this point, Cursor sees the files, but `AGENTS.md` and `docs/repo-memory.md` contain only TODO markers. The OS is installed but not yet project-aware.

Running `node scripts/init.mjs doctor` confirms:

```
Cursor OS vX.Y.Z — doctor
Target: /home/user/task-api

  ok   AGENTS.md
        note: 4 TODO placeholder(s) remain — run prompts/localize-cursor-os.md
  ok   .cursor/rules/core.mdc
  ok   .cursor/skills/implementation-loop/SKILL.md
  ok   .cursor/agents/verifier.md
  ok   docs/repo-memory.md
        note: 10 TODO placeholder(s) remain — run prompts/localize-cursor-os.md
  ok   docs/quality-rubric.md
  ok   prompts/localize-cursor-os.md
  ok   .cursor/.cursor-os-version

Cursor OS is installed. Run prompts/localize-cursor-os.md to complete setup.
```

After localization fills the placeholders (and removes the install-time notes), the same command reports:

```
Cursor OS appears installed and localized.
```

---

## Stage 3: After running the localization prompt

You open Cursor in the project, paste the contents of `prompts/localize-cursor-os.md`, and send it.

Cursor inspects the repo and produces edits to the OS files.

### Example: `AGENTS.md` project-context section (before → after)

**Before (base template):**

```markdown
## Project context

- **What this is:** TODO — one or two sentences on the product and who uses it.
- **Stack:** TODO — language(s), framework(s), data layer, deployment target.
- **How it's organized:** TODO — or point to `docs/architecture.md`.
- **Build / test / run commands:** TODO — the exact commands an agent should use.
```

**After (localized):**

```markdown
## Project context

- **What this is:** A REST API for task management used internally by operations teams. Manages tasks, assignments, and project hierarchies.
- **Stack:** Node.js 22, Fastify, PostgreSQL 16 via pg (no ORM), deployed to Fly.io.
- **How it's organized:** See `docs/architecture.md`. Routes live in `src/routes/`, business logic in `src/services/`, database queries in `src/db/`.
- **Build / test / run commands:**
  - Install: `npm install`
  - Dev: `npm run dev` (nodemon)
  - Test: `npm test` (node:test)
  - Lint: `npm run lint` (eslint)
  - Build: not applicable (Node.js)
```

---

### Example: `docs/repo-memory.md` (before → after, key sections)

**Before (base template):**

```markdown
## What this project is

TODO — one or two sentences: the product, who uses it, and the problem it solves.

## Stack and key dependencies

TODO — languages, frameworks, data layer, key libraries, and deployment target.

## Commands that matter

- Install: TODO
- Run / dev: TODO
- Test: TODO
```

**After (localized):**

```markdown
## What this project is

Internal task-management REST API. Operations teams use it to track work items, assignments, and project deadlines. Replaces a spreadsheet-based process.

## Stack and key dependencies

Node.js 22, Fastify 4, PostgreSQL 16 (raw `pg` driver, no ORM), Fly.io for deployment, GitHub Actions for CI.

## Commands that matter

- Install: `npm install`
- Run / dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Build: n/a
```

---

### Example: `docs/quality-rubric.md` additions

Localization appended project-specific verification checks to the generic rubric:

```markdown
## Project-specific verification (added during localization)

- [ ] `npm test` passes — node:test suite with no failures or skipped tests.
- [ ] `npm run lint` passes — zero ESLint errors.
- [ ] New endpoints are tested in `test/routes/`.
- [ ] Database queries use parameterized inputs — no string interpolation.
- [ ] Auth middleware (`src/middleware/auth.js`) applied to all non-public routes.
```

---

### Example: `docs/architecture.md` (created during localization)

Localization created this file because the project is non-trivial:

```markdown
# Architecture

## Request flow

Client → Fastify router (`src/routes/`) → Service layer (`src/services/`) → Database (`src/db/`)

Route handlers are thin. Business logic lives in services. Database access is centralized in `src/db/queries/`.

## Auth

JWT verification happens in `src/middleware/auth.js` and is applied as a Fastify plugin to all routes under `/api/`. The `/health` route is public.

## Key decisions

See `docs/decision-log.md`. Notable: no ORM (raw pg for query control), no pagination middleware (hand-rolled per-route).
```

---

### Example: rule changes

`frontend.mdc` was deleted because this is an API with no UI. `debugging.mdc` was kept as-is.

---

## Stage 4: Using the localized OS for a feature request

**Request:** "Add an endpoint to archive a task. Archived tasks should not appear in the default task list."

You paste `prompts/plan-feature.md` into Cursor with this request.

Because Cursor now knows the project, the plan it produces:

- References `src/routes/tasks.js` and `src/services/taskService.js` by name.
- Proposes a `PATCH /tasks/:id/archive` endpoint consistent with the existing REST style.
- Notes that `archived_at` should be a nullable timestamp column and drafts the migration.
- Flags that `GET /tasks` in `src/db/queries/tasks.js` needs a `WHERE archived_at IS NULL` clause.
- Includes the auth middleware in the plan because `docs/repo-memory.md` notes it's required on all routes.
- Lists `npm test` and `npm run lint` as the verification steps.

None of this required you to re-explain your stack, patterns, or conventions.

---

## Summary

| Stage | What Cursor knows | Quality of output |
| --- | --- | --- |
| No OS | Nothing about the project | Guesses; invents patterns; misses conventions |
| Base OS installed (unlocalized) | Structure exists; TODO placeholders | Marginally better (contract in scope); still guesses details |
| Localized OS | Real stack, commands, architecture, conventions | References actual code; matches patterns; flags missing auth middleware |
