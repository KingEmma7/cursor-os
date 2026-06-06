# Contributing to Cursor OS

Thanks for your interest. This project stays useful by staying small and specific. The best contributions usually remove, clarify, or make an existing workflow easier to apply.

## Philosophy

- Every file should improve agent behavior in a concrete way. If it reads like advice an agent already knows, cut it.
- No duplication across layers. Behavior lives in rules/`AGENTS.md`; memory lives in `docs/`; workflows live in `skills/` and `prompts/`.
- The base `template/` is framework-neutral. Stack-specific guidance is *generated during localization*, never shipped as blank templates.
- The installer stays dependency-free (Node built-ins only) and idempotent.
- Do not refer to prompts by number. Always use the full file path (e.g., `prompts/plan-feature.md`).

## The bar for adding a file

Before proposing a new rule, skill, agent, doc, or prompt, answer in the PR description:

1. What concrete failure does this prevent or behavior does it improve?
2. Why can't an existing file cover it?
3. Is it framework-neutral, or does it belong in a future stack preset?

If you can't answer all three, it probably shouldn't be added yet.

## Good vs. bad contributions

- **Bad:** Add `docs/security.md` with generic advice about validating inputs and keeping secrets out of logs.
- **Good:** Add a focused security boundary doc only when it captures project-specific auth, data, or compliance boundaries, or when it belongs in a future stack preset.
- **Bad:** Add a new rule that repeats `AGENTS.md` in different words.
- **Good:** Tighten an existing rule so it changes how agents behave in a concrete, observable way.

## File conventions (verified against Cursor docs)

- **Rules** — `.cursor/rules/*.mdc` with YAML frontmatter (`description`, `globs`, `alwaysApply`). Plain `.md` files in the rules dir are ignored by Cursor; use `AGENTS.md` for plain markdown. Keep `alwaysApply: true` rules short — every token is paid on every request.
- **Skills** — `.cursor/skills/<name>/SKILL.md`. Frontmatter requires `name` (lowercase, hyphens, must match the folder) and `description`. Optional: `paths`, `disable-model-invocation`.
- **Agents** — `.cursor/agents/<name>.md` with frontmatter `name`, `description`, `model`, `readonly`, `is_background`.
- **AGENTS.md** — plain markdown, supported by Cursor as a simple alternative to rules.

## Prompt naming convention

Prompts live in `template/prompts/` and use descriptive command-style names (e.g., `plan-feature.md`). Never number them. Always reference them by full file path in docs, code, and conversation.

## Development

```bash
npm test                          # run installer, doctor, and CLI smoke tests
node scripts/init.mjs init --dry-run    # preview an install into the current dir
node scripts/init.mjs doctor            # check install state of current dir
npm run pack:dry-run              # preview npm package contents
```

## Keeping tests in sync

When you add or rename a template file:
1. Update the `EXPECTED` array in `scripts/smoke-test.mjs`.
2. Confirm `doctor` still checks the full installed file set. It is derived from `template/`.
3. Update `README.md` and `CHANGELOG.md`.
4. Run `npm test`.

## Pull requests

- Keep PRs focused. One concern per PR.
- Update `README.md`, `CHANGELOG.md`, and `scripts/smoke-test.mjs` together when the template's file set changes.
- Run `npm test`, `npm run pack:dry-run`, and confirm `package.json` parses before opening the PR.
- Describe what changed, why, and how you verified it.

## Reporting issues

Open an issue with a concrete description: what you expected the agent to do, what it did instead, and which file should own the fix.
