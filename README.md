# Cursor OS

An installable operating layer that makes Cursor project-aware.

[![CI](https://github.com/KingEmma7/cursor-os/actions/workflows/ci.yml/badge.svg)](https://github.com/KingEmma7/cursor-os/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/package-json/v/KingEmma7/cursor-os)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Unofficial project.** Cursor OS is a community-maintained installable layer for Cursor. It is not affiliated with, endorsed by, or maintained by Cursor or Anysphere.

## The problem

When you open a project in Cursor and ask it to build a feature, the model has no idea:

- What the project is or who it's for.
- What your stack, routing, or data layer looks like.
- What your naming conventions, error-handling patterns, or test setup are.
- What architectural decisions were made last month and why.

So you re-explain your codebase in every session. The model guesses at your patterns. It invents approaches that don't fit. You spend time correcting output instead of shipping.

## How Cursor OS works

Cursor OS installs a lightweight set of files into your project that Cursor reads automatically:

```
AGENTS.md              # Engineering contract — auto-loaded by Cursor
.cursor/
  rules/               # Persistent behavior rules (always-on or opt-in)
  skills/              # Reusable multi-step workflows
  agents/              # The verifier — a skeptical review agent
docs/
  repo-memory.md       # Durable project facts
  quality-rubric.md    # Completion gate
  decision-log.md      # Append-only architecture decisions
prompts/
  localize-cursor-os.md    # The localization prompt (run once after install)
  plan-feature.md          # Plan a feature before coding
  implement-change.md      # Build with discipline
  debug-regression.md      # Find root causes
  review-pr.md             # Review changes before merging
  verify-work.md           # Independent verification pass
  update-repo-memory.md    # Keep memory current after big changes
```

The installer copies these files. The localization prompt fills them in for your project.

## The two-step setup

**Step 1 — Install the base OS** (the installer does this):

```bash
git clone https://github.com/KingEmma7/cursor-os.git ~/cursor-os
cd /path/to/your-project
node ~/cursor-os/scripts/init.mjs init
```

This gives you the structure. The files contain TODO placeholders — Cursor knows to use them, but they don't yet describe your project.

**Step 2 — Localize it** (you do this once in Cursor):

Open Cursor in your project. Paste the contents of `prompts/localize-cursor-os.md` into the chat and send it.

Cursor will inspect your repo, fill in the TODO markers with real facts (stack, commands, architecture, conventions), tune or remove irrelevant rules, and optionally create `docs/architecture.md` if the project warrants it. See [`examples/localization-example.md`](examples/localization-example.md) for a concrete before/after walkthrough.

After localization, Cursor works with your project's actual context instead of guessing.

## Designed for existing projects

Cursor OS is designed to drop into any project at any stage — greenfield or mature codebase. The installer never overwrites existing files; it skips them and reports.

```bash
# From the root of any existing project
node /path/to/cursor-os/scripts/init.mjs init

# Preview what would be installed first
node /path/to/cursor-os/scripts/init.mjs init --dry-run

# Check if Cursor OS is already installed
node /path/to/cursor-os/scripts/init.mjs doctor
```

For new repos, create your project normally first, then run the installer from the project root. This repository's root is the Cursor OS source project, not the installed project layout.

## How to know it is working

After localization:

- `AGENTS.md` has real content in the "Project context" section — no `TODO` markers.
- `docs/repo-memory.md` has your actual stack, commands, and conventions filled in.
- When you paste `prompts/plan-feature.md` into Cursor and describe a feature, the plan references your actual architecture and patterns without you explaining them.
- When you paste `prompts/implement-change.md`, Cursor follows your conventions without being told.

Use the Cursor OS checkout to check the installation state:

```bash
node ~/cursor-os/scripts/init.mjs doctor --target /path/to/your-project
```

Example output:

```
Cursor OS vX.Y.Z — doctor
Target: /path/to/your-project

  ok   .cursor/agents/verifier.md
  ok   .cursor/rules/core.mdc
  ok   .cursor/skills/implementation-loop/SKILL.md
  ok   AGENTS.md
        note: 4 TODO placeholder(s) remain — run prompts/localize-cursor-os.md
  ok   docs/quality-rubric.md
  ok   docs/repo-memory.md
        note: 10 TODO placeholder(s) remain — run prompts/localize-cursor-os.md
  ok   prompts/localize-cursor-os.md
  ok   .cursor/.cursor-os-version
```

(Abbreviated — `doctor` lists every installed file; the version shown matches your checkout. The `note:` lines flag the unfilled TODO placeholders in `AGENTS.md` and `docs/repo-memory.md` that localization resolves. Once localization fills them, `doctor` reports "installed and localized". If the install came from an older Cursor OS version, `doctor` also notes the drift so you can re-run `init` to pick up new files.)

`init` runs this same health check automatically after installing, so you always see the placeholder count and the next step without a separate command.

## What Cursor loads automatically vs. what you paste

**Automatic** — `AGENTS.md` and any rule with `alwaysApply: true` load on every session. Rules with a `description` are pulled in when Cursor judges them relevant; rules with `globs` attach when matching files are in context. Skills surface when their `description` matches the task.

**Manual** — files in `prompts/` are not auto-loaded. Copy the relevant prompt into Cursor chat when you want that workflow.

This separation is intentional: standards are always on; workflows are on-demand.

## Typical workflow

```
localize-cursor-os.md   (once after install)
       ↓
plan-feature.md   →   implement-change.md   →   verify-work.md   →   review-pr.md
```

See the [prompts guide](template/prompts/README.md) (installs as `prompts/README.md`) for when to use each prompt.

## When not to use the full workflow

- **One-off, trivial changes** — for a tiny fix, just ask Cursor directly. The prompts add structure for non-trivial work.
- **Exploratory prototyping** — before you know what you're building, the planning prompts may feel like overhead. Use them once the direction is clearer.
- **Teams with a mature process** — if you already have strong conventions enforced elsewhere, you may only want a subset of what Cursor OS provides (e.g., just `AGENTS.md` and `docs/repo-memory.md`).

## Cursor OS vs. custom instruction packs

Custom instruction sets or system-prompt files (sometimes called "behavioral guideline packs") tell Cursor how to behave generically. Cursor OS does something different: it tells Cursor about *this* project specifically. The two are complementary. Cursor OS files live in the repo, travel with the code, and get updated as the project evolves.

## Current status

Cursor OS is **not published to npm yet**. For v0.1, clone the repo and run the installer script directly.

```bash
git clone https://github.com/KingEmma7/cursor-os.git ~/cursor-os
cd your-project
node ~/cursor-os/scripts/init.mjs init
```

`npx cursor-os init` is planned for a future release.

Before publishing, run through [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md). The checklist covers release readiness, package metadata, installer checks, template quality, and `npm pack --dry-run`.

## CLI reference

```
node scripts/init.mjs <command> [target] [options]

Commands:
  init      Install Cursor OS into the target directory
  doctor    Check whether Cursor OS is installed in the target directory

Options:
  -n, --dry-run     Preview changes without writing anything (init only)
  -t, --target DIR  Use DIR as the target directory
  -v, --version     Print version and exit
  -h, --help        Show this help
```

A command is required: bare invocation (`node scripts/init.mjs` with no arguments) prints help and never writes files. For a target directory named `init` or `doctor`, or one whose name starts with `-`, use the explicit form `init --target <dir>`. Requires Node.js 20 or newer.

## What gets installed

```
AGENTS.md
.cursor/
  rules/
    core.mdc           # Always-on behavior and contract reference
    frontend.mdc       # Opt-in: UI/component conventions
    debugging.mdc      # Opt-in: debugging discipline
  skills/
    implementation-loop/SKILL.md
    debugging-loop/SKILL.md
  agents/
    verifier.md        # Read-only skeptical reviewer
docs/
  repo-memory.md
  quality-rubric.md
  decision-log.md
prompts/
  README.md
  localize-cursor-os.md
  plan-feature.md
  implement-change.md
  debug-regression.md
  review-pr.md
  verify-work.md
  update-repo-memory.md
```

## The layers

| Layer | Lives in | What it does |
| --- | --- | --- |
| Contract | `AGENTS.md` | Project identity, stack, commands, engineering standards |
| Rules | `.cursor/rules/*.mdc` | Persistent Cursor behavior; `core.mdc` is always-on |
| Memory | `docs/` | Durable facts, quality gate, decision history |
| Skills | `.cursor/skills/*/SKILL.md` | Multi-step workflows Cursor can invoke |
| Agents | `.cursor/agents/*.md` | The verifier — runs on demand |
| Prompts | `prompts/*.md` | Commands you paste in for specific workflows |

## Roadmap

- `v0.1` — installable operating layer: contract, rules, skills, verifier, docs, prompts, installer, doctor command.
- `v0.2` — npm publishing (`npx cursor-os init`), interactive setup with project detection, stack presets (Next.js, Supabase, Vercel).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The bar for adding a file is high: it should improve agent behavior in a concrete way without duplicating an existing layer.

For support and security reporting, see [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
