# Project-pinned README tools

This repository pilots mise for the released CLI used by README commands.
`mise.toml` owns the mdtheme version; `mise.lock` records release URLs and
checksums for Linux, macOS, and Windows. Binaries live in mise's data directory,
outside the repository. A different repository can choose a different version.

## Set up your checkout

Install mise using its [installation instructions](https://mise.jdx.dev/getting-started.html).
The CI workflow pins the mise version tested by this pilot. Review this
repository's `mise.toml`, then explicitly trust it and install its tools:

```sh
mise trust
mise install --locked
```

This setup downloads the pinned mdtheme release and verifies its locked archive
checksum. It does not add a Node manifest, install a global mdtheme, or enable
Git hooks. The current release includes Windows AMD64, Linux ARM64/AMD64 with
GNU libc, and macOS ARM64/AMD64; Linux binaries target Ubuntu 24.04 or newer.

## Use the project version

```sh
mise run readme:write
mise run readme:check
mise run readme:pre-push
```

These tasks resolve mdtheme with `mise which` before executing its absolute
path. They disable mise network access, and the project disables automatic
installation and system fallback. A missing version fails instead of invoking
an unrelated Homebrew installation. Run `mise install --locked` explicitly to
repair missing setup. Git themes still fetch their configured revision: mise's
offline setting does not disable mdtheme's Git operations.

For a pre-push hook, use `exec mise run readme:pre-push` in place of
`exec mdtheme pre-push`. Keep existing checks and propagate failure; see the
[hook guide](pre-push.md). mise must be on PATH in the hook's environment.

## Update the version

Edit the exact mdtheme version in `mise.toml`, then refresh all supported targets:

```sh
mise lock --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64
mise install --locked
mise run readme:check
```

Review the version, URLs, and checksums and commit both tool files together.
A standards upgrade must preserve this project-owned pin. The mise version
itself is independently pinned in CI; updating it requires rerunning the pilot
checks before changing the supported setup.

## Developing mdtheme itself

The released CLI is a consumer tool, not the source build under test.
`sh scripts/check.sh` still builds and tests the current Cargo sources and an
installed Cargo package. It also checks generation with that current build.
The separate CI job checks the released project pin. A deliberate output change
may require coordinating a new release and pin; do not remove the source check
to hide a disagreement.

Run the integration suite with mise on PATH:

```sh
python3 scripts/test-project-tools.py
```

It uses temporary data/cache directories and fixture projects, explicitly
installs the real release, tests offline execution, rejects wrong checksums,
and checks missing/wrong versions and pre-push behavior. It does not change your
normal mise installation. There is currently only one usable native release;
successful coexistence of two different published versions remains unverified.
The wrong-version test proves rejection, not successful multi-version switching.
