# mdtheme

A native Rust CLI and library for composing Markdown. Use US English.
Read docs/adr/README.md for living decisions and update the relevant ADR when
an agreed contract changes. Source is in src/, tests in tests/.

Run sh scripts/check.sh before pushing. It checks formatting, Clippy, tests,
the generated README, and an installed Cargo package. Run cargo deny check
when dependencies change. Cargo.toml declares the minimum Rust version.

Edit README.md.src and run cargo run -- --write. Configuration is mdtheme.yaml.
Themes contain header/footer and optional badge fragments; Git sources default to main and refresh
on every invocation. Never execute theme code or mutate source files.
Check mode never writes project files. Pre-push never stages or commits.

Historical JavaScript Git revisions retain their dist files; new revisions
build from Cargo sources. Keep the package free of browser dependencies and
speculative plugin APIs. Package changes require an installed-consumer check.

Keep the CLI pin project-owned in mise.toml and mise.lock; never add Node
files solely to run README generation. docs/standards-integration.md records
README tooling ownership. Repository configuration and checks are project-owned;
shared infrastructure guidance lives in sebastian-software/project-infra.
