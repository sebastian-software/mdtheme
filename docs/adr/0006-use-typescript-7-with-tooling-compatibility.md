# Use TypeScript 6 across the development toolchain

- Status: accepted
- Updated: 2026-09-10

Use one stable TypeScript 6 dependency for type checking, builds, lint tooling,
and the packed consumer's declaration checks. Keep the exact version in
`package.json`. There is no native compiler dependency or compatibility alias.

The earlier TypeScript 7 migration needed a separate TypeScript 6 API package
for ESLint. For this small codebase, the compiler's performance benefit does
not justify the additional dependency and ecosystem compatibility work.
TypeScript 6 supports the project's language features and keeps the compiler
and its tooling on the same implementation.

Revisit TypeScript 7 when the relevant tools support it directly or measured
build costs justify the migration. Validate any compiler upgrade with lint,
type checking, builds, and the installed package consumer. Review generated
JavaScript and declarations for changes rather than assuming compatibility.

This living record retains its original filename so existing links remain
valid. Git history records the previous dual-compiler decision.
