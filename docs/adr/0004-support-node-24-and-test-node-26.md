# Support the native CLI across desktop and CI platforms

- Status: accepted
- Updated: 2026-09-11

The Rust port removes the Node runtime requirement. Build from source using the
minimum Rust version declared in `Cargo.toml`. Installed binaries need no Rust
or JavaScript runtime. Git is required for remote theme sources and pre-push
checks; local Markdown generation does not require it.

CI checks Linux, macOS, and Windows. Cross-platform tests cover the CLI and
filesystem contracts as well as library behavior. Release artifact targets and
distribution channels must be verified before they are advertised as available.

The earlier Node 24 minimum and Node 24/26 CI matrix applied to the TypeScript
implementation. This living record keeps its original path so existing links
remain valid. Git history preserves that runtime decision. See the
[native migration decision](0009-native-cli-and-data-only-themes.md).
