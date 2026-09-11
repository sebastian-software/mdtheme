# Standards integration

The TypeScript implementation used `@sebastian-software/standards@0.10.0` with a
narrow pnpm patch for explicit README ownership. That bridge came from
[standards PR #81](https://github.com/sebastian-software/standards/pull/81), commit
`30d7215`, plus local mdtheme rename adjustments.

The native port removes the Node dependency, pnpm patch, and Node-specific
validation path. The old bridge is historical context, not a requirement for
running or developing the Rust CLI. Git history retains the patch if an older
JavaScript revision needs maintenance.

`README.md.src` and `mdtheme.yaml` now define this repository's README generation.
The generated file remains owned by mdtheme. Do not introduce another tool that
rewrites its framing. Native checks are documented in [maintaining mdtheme](maintaining.md).

Existing standards-managed files and marker sections remain subject to their
repository guardrails. A future Rust standards integration should use the
supported upstream configuration and preserve mdtheme's README ownership;
it should not restore the old npm dependency solely to run README generation.

The Rust standards reference files have been applied. The current standards 13
README ownership check still expects an npm dependency and a TypeScript config.
It does not recognize the native YAML setup yet. That upstream incompatibility
remains unresolved; the repository gate uses Cargo and mdtheme's own README
check rather than claiming standards consistency passes.
