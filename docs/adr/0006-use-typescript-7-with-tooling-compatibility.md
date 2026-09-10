# Use TypeScript 7 with tooling compatibility

- Status: accepted
- Updated: 2026-09-10

Use the stable TypeScript 7 compiler for type checking, builds, and the packed
consumer's declaration checks. Keep the official TypeScript 6 compatibility
package available under the `typescript` name for tools that import the
compiler API, including typescript-eslint.

TypeScript 7 does not yet expose that API. Replacing the `typescript` package
directly would break those tools. Staying entirely on TypeScript 6 would defer
the compiler update. The official side-by-side alias setup lets the project
update its compiler while preserving the lint pipeline.

`@typescript/native` supplies `tsc`; the `typescript` alias supplies the older
API and `tsc6`. Exact versions belong in `package.json`. This adds a second
development dependency, so remove the bridge when the lint tooling supports
the new compiler API. Validate changes with lint, type checking, the build,
and the installed package consumer, including generated declaration files.

See the [official side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0).
