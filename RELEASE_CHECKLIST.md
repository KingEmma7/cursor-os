# Release checklist

Use this checklist before tagging a public release or publishing Cursor OS to npm.

## Repository

- [ ] Clean repo is live at `https://github.com/KingEmma7/cursor-os`.
- [ ] Default branch is correct.
- [ ] README badge URLs point to the public repo and resolve.
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
- [ ] `node scripts/init.mjs` with no arguments prints help and writes nothing.
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
- [ ] No hardcoded version strings in `README.md` or `examples/` (the badge is dynamic; example outputs use `vX.Y.Z`). Versions appear only in `package.json` and `CHANGELOG.md`.
- [ ] Final old-branding search has no matches outside historical changelog context.
- [ ] Final search has no numbered prompt references outside historical changelog context.

## Packaging integrity

- [ ] `npm pack`, install the tarball into a scratch project, and run the bin: `init`, `doctor`, and bare invocation all behave. (CI runs this on every push.)
- [ ] `import('cursor-os')` resolves and exposes `install` and `doctor`.
- [ ] `head -1 scripts/init.mjs` is exactly `#!/usr/bin/env node` (no CRLF, no BOM).
- [ ] No stray `*.tgz` files tracked in git.

## npm publishing

Only after all previous sections pass:

- [ ] npm account has 2FA enabled (at minimum for writes).
- [ ] Confirm the intended version.
- [ ] Update `CHANGELOG.md` with release date.
- [ ] Create a git tag for the release.
- [ ] Run `npm publish --dry-run`.
- [ ] Run `npm publish` only when intentionally publishing.
- [ ] README install examples use the `npx cursor-os` form (done in the release commit, not after).
- [ ] After publish, verify with `npm view cursor-os` and `npx cursor-os@latest init --dry-run --target <tmp>`.
