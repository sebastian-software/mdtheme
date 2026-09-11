# Use the Rust development toolchain

- Status: accepted
- Updated: 2026-09-11

Use Cargo for dependency resolution, builds, tests, and packaging, with rustfmt
and Clippy for formatting and lint checks. Keep the minimum Rust version in
`Cargo.toml` and resolved dependencies in `Cargo.lock`.

The native implementation replaces TypeScript 6 and its Node lint tooling.
There is no TypeScript compiler, compatibility alias, or JavaScript configuration
loader in the new product. YAML configuration and literal theme files remove
the need to execute user scripts. See the
[native CLI decision](0009-native-cli-and-data-only-themes.md).

This living record retains its original filename so existing links remain
valid. Git history records the earlier TypeScript 7 and TypeScript 6 choices.
Revisit toolchain requirements when dependencies or supported targets require it.
