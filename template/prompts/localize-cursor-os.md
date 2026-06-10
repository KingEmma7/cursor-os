# Prompt: Localize Cursor OS to this repo

**File:** `prompts/localize-cursor-os.md`

Paste this into Cursor (Agent) after installing Cursor OS. It inspects the repo and adapts the OS to your actual stack, architecture, and conventions.

Run it once after install, and again after a major architectural change.

---

You are localizing the "Cursor OS" that was just installed into this repository. Your job is to make its generic files describe *this* project accurately, and to remove parts that don't apply.

## Hard rules

- **Do not invent.** Only write things you can verify from the actual code, config, and docs. If you can't confirm something, leave a clear `TODO:` marker describing what's needed — never guess at architecture, commands, or product claims.
- **Stay in scope.** You may only create or edit the files listed under "Files you may touch." Do not modify application source code.
- **Be concise.** Short, true, and useful beats long and generic. Cut anything an agent already knows.
- **Pause for larger repos.** Before editing, show a short localization plan and wait for approval if the repo has more than 100 files or multiple apps/packages.

## Files you may touch

- `AGENTS.md` — fill in the project-context section.
- `docs/repo-memory.md` — fill in stack, layout, commands, conventions, constraints.
- `docs/quality-rubric.md` — add project-specific checks (real commands, budgets).
- `docs/architecture.md` — **create** if the project is non-trivial (see below).
- `docs/product-doc.md` — **create** only if you can describe the product truthfully from existing docs/README.
- `.cursor/rules/*.mdc` — delete or sharpen the opt-in rules (`frontend.mdc`, `debugging.mdc`) based on what the repo actually is. Do not weaken `core.mdc`.

Report any other file you believe should change, but do not change it.

## Steps

1. **Inspect.** Detect the language(s), framework(s), package manager, data layer, and deployment target from manifests and config (e.g. `package.json`, lockfiles, `pyproject.toml`, `go.mod`, Dockerfiles, CI). Read the README and any existing docs. Map the top-level directory structure and identify where the real logic lives.

2. **Extract the real commands.** Find the actual install / dev / test / lint / typecheck / build commands from scripts and CI. Use these verbatim — do not assume conventional names.

3. **Fill `docs/repo-memory.md`.** Replace every TODO you can verify: what the project is, stack, organization, commands, conventions, and constraints. Leave TODOs only where the repo genuinely doesn't answer the question. When done, delete the install-time blockquote note near the top of the file.

4. **Fill `AGENTS.md` project-context section.** Keep it to a few true sentences; point to `docs/architecture.md` for detail rather than duplicating it. When done, delete the install-time blockquote note near the top of the file.

5. **Create `docs/architecture.md`** if the project is non-trivial: the main modules/services, how data flows, key boundaries, and important patterns — all grounded in the code. Skip it for a tiny repo and say why.

6. **Create `docs/product-doc.md`** only if you can describe the product truthfully from existing material. Otherwise leave a single `TODO:` line and move on. Never fabricate users, metrics, or goals.

7. **Tune the rules.** If there's no UI, delete `frontend.mdc`. If a rule's generic guidance can be replaced with the project's real conventions, do so. Keep `core.mdc` intact.

8. **Tighten `docs/quality-rubric.md`** with the project's real verification commands and any known budgets or compliance requirements.

## Report

When done, output:

- What you detected (stack, structure, commands).
- Each file you created or edited and a one-line summary of the change.
- Every `TODO:` you left and what's needed to resolve it.
- Anything you recommend changing that was out of scope.
