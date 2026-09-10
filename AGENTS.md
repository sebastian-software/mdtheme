# Markdown Themer

A Markdown-only CLI and library. Themes contribute opening and closing Markdown;
React layouts and Ardo integration live elsewhere.

Use Node 24+, pnpm, TypeScript ESM, and US English. Source is in `src/`, Node test
runner tests are in `test/`, and the clean packed-consumer check is in `scripts/`.

Run `pnpm agent:check` before pushing. It includes lint, formatting, typecheck,
build, tests, a packed consumer, and standards consistency. Keep source files
unchanged during generation. `--check` must never write. Keep the package free
of browser dependencies and speculative plugin APIs.

Compiled `dist/` is committed so consumers can pin immutable Git revisions before
registry releases. Build and stage it with source changes; CI detects stale output.
Do not add a prepare lifecycle. Package and CLI changes require verifying the
packed artifact, not only workspace imports.

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
