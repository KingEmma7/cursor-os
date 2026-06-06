# Support

Cursor OS is currently pre-npm and maintained as an open-source project.

## Before opening an issue

1. Read the README setup flow.
2. Run:

   ```bash
   npm test
   node scripts/init.mjs doctor --target /path/to/your-project
   ```

3. If Cursor OS is installed but still generic, run `prompts/localize-cursor-os.md` in Cursor. The base template is not project-aware until localization runs.

## Where to ask

- **Bug reports** — use the bug report issue template.
- **Feature ideas** — use the feature request or proposal template.
- **Security-sensitive reports** — follow `SECURITY.md`; do not open a public issue.

## What to include

For installer or CLI issues, include:

- OS and Node.js version.
- Exact command run.
- Full output.
- Whether the target directory already had `AGENTS.md`, `.cursor/`, `docs/`, or `prompts/`.

For prompt/template issues, include:

- Which prompt or template file was involved.
- What you expected Cursor to do.
- What Cursor did instead.
- Whether the project had already been localized with `prompts/localize-cursor-os.md`.

## Boundaries

Cursor OS provides project-local guidance and workflows. It does not provide support for every framework, database, deployment platform, or application-specific bug in projects that install it.
