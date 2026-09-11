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

## Native installation contract

Install mdtheme independently of the consuming project's package manager. Local
users can use the shared Homebrew tap; CI can run the version-pinned shell
installer from [the installation guide](installation.md#github-actions).
`standards` should validate YAML ownership and invoke `mdtheme --check` from PATH;
it should not silently download tools during `standards check` or create a Node
manifest in a Rust repository. Tool installation belongs in an explicit setup
step, while `standards apply` may seed the YAML config and CI step.

This is the intended upstream integration, not an available standards feature.
The current upstream main branch does not include the earlier Markdown ownership
bridge. Coordinate that bridge and the native YAML contract before enabling the
standards ownership gate here. The native CLI's own check remains authoritative.
