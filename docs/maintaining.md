# Maintaining mdtheme

Use Rust, Cargo, and Git. The minimum Rust version is declared in `Cargo.toml`;
exact dependencies are recorded in `Cargo.lock`. CI checks the native CLI on
Linux, macOS, and Windows.

From a checkout, run:

```sh
cargo build --locked
bash scripts/check.sh
```

The gate checks formatting, Clippy, tests, package contents and installation,
and generated README consistency. Verify the packaged CLI after public API,
command, or packaging changes; workspace execution alone does not prove an
installed artifact works. Build artifacts in `target/` are not committed.

## Project decisions

Read the [architecture decisions](adr/README.md) before changing a project
contract. ADRs are living documents: update the current record and its date
when an agreed decision changes. Keep executable settings in their owning
configuration files.

## README generation

The editable project corpus is `README.md.src`. The YAML config selects the
local company theme. After changing either, run:

```sh
cargo run -- --write
cargo run -- --check
```

Review the generated README with the source changes. Check mode never repairs
the output. Example READMEs also need regeneration when their source or theme
files change.

## Distribution

The native port can be installed from source with `cargo install --path . --locked`.
The native release workflow uses Release Please and builds binaries for Linux,
macOS, and Windows. It also prepares checksums and a Homebrew formula artifact.
These paths are not published or verified yet; a generated formula does not by
itself make `brew install mdtheme` available.

Cargo publication is an explicit manual workflow choice through
`publish_crate=true` and requires `CARGO_REGISTRY_TOKEN`. Credentials and registry
publication have not been verified. Do not advertise registry installation or
release downloads until the artifacts and installation paths have been checked.

Historical npm packages remain JavaScript products. The Rust CLI replaces that
implementation rather than publishing a native release through the old npm
workflow. See the [migration guide](migration.md) for user-facing changes and
[standards integration](standards-integration.md) for the removed Node tooling.
