# Installation

Native releases provide binaries for macOS and Linux on Apple Silicon/ARM64 and
Intel/AMD64, plus Windows on Intel/AMD64. No Rust or Node runtime is needed.
Git is required for Git themes and `pre-push`.

## Homebrew

The Sebastian Software tap provides mdtheme:

```sh
brew install sebastian-software/tap/mdtheme
mdtheme --version
```

Update with `brew update && brew upgrade mdtheme`. The tap checks new GitHub
releases and tests the formula before publishing an update, so a release may
appear there later than on GitHub.

## Shell installer

On macOS or Linux, download the installer from the release, inspect it if desired,
and run it:

```sh
curl -fsSL https://github.com/sebastian-software/mdtheme/releases/latest/download/install.sh -o install-mdtheme.sh
sh install-mdtheme.sh
```

It installs to `~/.local/bin` without sudo and tells you if that directory is
missing from PATH. It verifies the archive's SHA-256 checksum and runs the binary
before replacing an existing installation. Checksums detect damaged or mismatched
assets; they are served from the same GitHub release as the archives.

Choose a version and directory explicitly for a reproducible installation:

```sh
sh install-mdtheme.sh --version 0.4.0 --bin-dir "$HOME/.local/bin"
```

Run the installer again to update. Remove `~/.local/bin/mdtheme` to uninstall.
The installer does not edit shell profiles or install Git. Linux archives target
GNU libc on Ubuntu 24.04 or newer; Alpine and older distributions should build
from source. Windows users should use the archive below.

## Download an archive

Open [GitHub Releases](https://github.com/sebastian-software/mdtheme/releases),
download the archive for your operating system and CPU, and verify its hash
against `SHA256SUMS`. Extract `mdtheme` (or `mdtheme.exe`) into a directory on PATH.
On Windows, `Get-FileHash ARCHIVE -Algorithm SHA256` prints the hash; `tar -xzf
ARCHIVE` extracts the binary.

## Build from source

With Rust and Cargo installed, build a reviewed release:

```sh
cargo install --git https://github.com/sebastian-software/mdtheme --tag mdtheme-v0.4.0 --locked
```

Or run `cargo install --path . --locked` from a checkout. Cargo installs into its
binary directory, usually `~/.cargo/bin`. The minimum Rust version is declared in
`Cargo.toml`. crates.io publication requires separate registry authorization;
until it is enabled, use Git or a local path instead of `cargo install mdtheme`.

## GitHub Actions

Pin both the installer and binary version in CI:

```yaml
- name: Install mdtheme
  env:
    MDTHEME_VERSION: 0.4.0
  run: |
    curl -fsSL "https://github.com/sebastian-software/mdtheme/releases/download/mdtheme-v$MDTHEME_VERSION/install.sh" -o "$RUNNER_TEMP/install-mdtheme.sh"
    sh "$RUNNER_TEMP/install-mdtheme.sh" --version "$MDTHEME_VERSION" --bin-dir "$HOME/.local/bin"
    echo "$HOME/.local/bin" >> "$GITHUB_PATH"
- run: mdtheme --check
```

This example targets Linux and macOS runners and needs no Cargo setup step.
