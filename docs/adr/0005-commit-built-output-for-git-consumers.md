# Commit built output for Git consumers

- Status: accepted
- Updated: 2026-09-10

Commit `dist/` alongside source changes so consumers can install an immutable
Git revision without compiling the package. The npm package also exposes its
compiled ESM entry points and TypeScript declarations from `dist/`.

The alternative is a `prepare` lifecycle that builds during installation.
Keeping compiled output makes installation independent of a consumer's build
tools and avoids running that lifecycle. The cost is generated changes in
reviews and a responsibility to keep them aligned with source.

The build and `check:dist` gate detect stale committed output. The packed
consumer verifies CLI execution, TypeScript configs, public types, and API
imports after installation. Workspace tests alone cannot establish that the
published files work. Revisit this decision if immutable Git installs are no
longer supported.
