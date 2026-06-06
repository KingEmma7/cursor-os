# Release checklist

Use this checklist before syncing Cursor OS into the clean `KingEmma7/cursor-os` repo or publishing to npm.

## Repository

- [ ] Clean repo exists at `https://github.com/KingEmma7/cursor-os`.
- [ ] Default branch is correct.
- [ ] README badge URLs point to the clean repo and resolve.
- [ ] Repository description matches the README tagline: "Make Cursor project-aware."
- [ ] Topics include `cursor`, `agents-md`, `ai-assisted-development`, and `developer-tools`.
- [ ] Issue templates and PR template are present.
- [ ] `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `LICENSE` are present.

## Package metadata

- [ ] npm package name `cursor-os` is available or owned by the maintainer.
- [ ] `package.json` has the correct `name`, `bin`, `repository`, `bugs`, `homepage`, `keywords`, `license`, and `engines`.
- [ ] No `publishConfig` is added until the package is intentionally ready to publish.
- [ ] `npm pack --dry-run` includes only expected files.

## Installer and CLI

- [ ] `node scripts/init.mjs --help` shows `init`, `doctor`, `--target`, `--dry-run`, and `--version`.
- [ ] `node scripts/init.mjs --version` matches `package.json`.
- [ ] `node scripts/init.mjs init --dry-run --target <tmp>` writes nothing.
- [ ] `node scripts/init.mjs init --target <tmp>` installs the expected file set.
- [ ] `node scripts/init.mjs doctor --target <installed-tmp>` exits 0.
- [ ] `node scripts/init.mjs doctor --target <empty-tmp>` exits non-zero and lists missing files.
- [ ] Invalid commands and invalid `--target` usage exit non-zero without writing files.

## Template quality

- [ ] Template files remain framework-neutral.
- [ ] No stack presets (Next.js, React, Supabase, Vercel, etc.) are included in the base template.
- [ ] Prompt files use descriptive command-style names and are referenced by full path.
- [ ] `prompts/localize-cursor-os.md` accurately explains that the base OS is not project-aware until localization runs.
- [ ] `docs/repo-memory.md` and `AGENTS.md` intentionally contain TODO markers for localization.

## Verification

- [ ] `npm test` passes.
- [ ] `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` succeeds.
- [ ] Final old-branding search has no matches outside historical changelog context.
- [ ] Final search has no numbered prompt references outside historical changelog context.

## npm publishing

Only after all previous sections pass:

- [ ] Confirm the intended version.
- [ ] Update `CHANGELOG.md` with release date.
- [ ] Create a git tag for the release.
- [ ] Run `npm publish --dry-run`.
- [ ] Run `npm publish` only when intentionally publishing.
- [ ] After publish, update README install examples from local script usage to `npx cursor-os init`.
