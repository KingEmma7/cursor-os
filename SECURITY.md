# Security policy

Cursor OS is an installable set of repo-local guidance, prompts, rules, and a dependency-free Node.js installer.

## Supported versions

Until the first public release, only the current `main` branch is supported.

After npm publishing begins, security fixes will target the latest released minor version unless otherwise stated in the changelog.

## Reporting a vulnerability

Please do **not** open a public issue for security-sensitive reports.

If GitHub private vulnerability reporting is enabled on the repository, use that channel. Otherwise, contact the maintainer privately through the contact method listed on the maintainer's GitHub profile.

Include:

- A concise description of the issue.
- Steps to reproduce.
- Affected files or commands.
- Whether the issue can overwrite user files, expose secrets, execute untrusted code, or mislead agents into unsafe behavior.

## Scope

Security-sensitive issues include:

- Installer behavior that can overwrite or delete user files.
- Path handling bugs that write outside the intended target.
- Prompt or rule guidance that encourages leaking secrets, bypassing authorization, or fabricating project facts.
- Supply-chain risks in package metadata or release process.

Out of scope:

- Generic advice quality concerns that do not create a concrete security risk.
- Vulnerabilities in projects that install Cursor OS.
- Issues requiring a malicious user to edit their own local template files.

## Design constraints

- The installer must remain dependency-free.
- The installer must never overwrite existing user files.
- The base template must remain framework-neutral and must not include secrets, credentials, or project-specific assumptions.
