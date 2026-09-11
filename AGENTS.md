# mdtheme

A native Rust CLI and library for composing Markdown. Use US English.
Read docs/adr/README.md for living decisions and update the relevant ADR when
an agreed contract changes. Source is in src/, tests in tests/.

Run sh scripts/check.sh before pushing. It checks formatting, Clippy, tests,
the generated README, and an installed Cargo package. Run cargo deny check
when dependencies change. Cargo.toml declares the minimum Rust version.

Edit README.md.src and run cargo run -- --write. Configuration is mdtheme.yaml.
Themes contain header.md/footer.md; Git sources default to main and refresh
on every invocation. Never execute theme code or mutate source files.
Check mode never writes project files. Pre-push never stages or commits.

Historical JavaScript Git revisions retain their dist files; new revisions
build from Cargo sources. Keep the package free of browser dependencies and
speculative plugin APIs. Package changes require an installed-consumer check.

Standards 13's mdtheme checker still requires npm scripts and TypeScript
configs. docs/standards-integration.md records that external incompatibility.
Do not reintroduce Node files to satisfy the obsolete integration check.

---

<!-- sebastian-software-consumer-agents:start -->

# Standards-managed repo guardrails

- Do not hand-edit managed files or standards-owned marker sections.
- If `standards check` reports drift, run `standards apply` or update standards.
- The repository's own gate may omit `standards check`; CI can still fail on it.

Node repositories:

- Fix or format every file reported by `oxfmt` whenever practical.
- For generated files, prefer formatting in the generator step.
- If formatting is not viable, use repo-local `.prettierignore`.
- Never add repo-specific ignores to managed `.oxfmtrc.json`.

Rust repositories:

- Keep `cargo fmt --all --check` and
  `cargo clippy --workspace --all-targets --all-features -- -D warnings` green.
- Lint levels belong in `[workspace.lints]`, never in managed `rustfmt.toml`.
- `rust-version` in `Cargo.toml` is the only MSRV; every other mention is a
  derived copy.
- Record a cargo-deny finding as a narrow, commented exception in `deny.toml` —
  never by widening the org allow-list.

<!-- sebastian-software-consumer-agents:end -->
