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

Release Please prepares releases below 1.0: breaking changes bump the minor
version and other features bump the patch version. Merge the release PR after
reviewing its version, changelog, and Cargo lockfile. The publish workflow builds
five target archives, checksums, an installer, and a Homebrew formula. The tap's
update workflow installs and tests the formula before committing it.

If artifact publication fails, rerun `publish` manually with the existing tag.
Do not move a published tag. Keep the installer and formula archive names in
sync with the build matrix. Run `cargo build --locked` followed by
`python3 scripts/test-installer.py` when changing installation behavior. The
suite exercises the built CLI; CI runs it on macOS and Linux after the build.

Cargo publication is a separate manual workflow choice through
`publish_crate=true` and requires `CARGO_REGISTRY_TOKEN`. Registry authorization
has not been configured. GitHub downloads and Homebrew do not depend on it.

Historical npm packages remain JavaScript products. The Rust CLI replaces that
implementation rather than publishing a native release through the old npm
workflow. See the [migration guide](migration.md) for user-facing changes and
[standards integration](standards-integration.md) for the removed Node tooling.
