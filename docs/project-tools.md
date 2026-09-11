# Project-pinned README tools

Use mise to give each repository its own mdtheme version. Contributors, Git
hooks, and CI use the same pin. `mise.toml` owns that version; `mise.lock` records
release URLs and checksums. Installed binaries live outside the repository.
This works in Rust, Node, or other projects and does not require standards.

## Add mdtheme to your project

Install mise using its [installation instructions](https://mise.jdx.dev/getting-started.html).
This integration is tested with mise 2026.9.5. In your project root, create
`mise.toml` with the following configuration. If the file already exists, merge
these entries with your existing tools and tasks. The settings disable automatic
tool installation and fallback for the whole project, including other mise tools.

```toml
[tools."github:sebastian-software/mdtheme"]
version = "0.4.0"
version_prefix = "mdtheme-v"

[settings]
auto_install = false
not_found_auto_install = false
not_found_system_fallback = false

[tasks."readme:check"]
description = "Check the README with the project's installed mdtheme version"
shell = "bash -c"
env = { MISE_OFFLINE = "true" }
run = 'binary=$(mise which mdtheme) && "$binary" --check'

[tasks."readme:write"]
description = "Generate the README with the project's installed mdtheme version"
shell = "bash -c"
env = { MISE_OFFLINE = "true" }
run = 'binary=$(mise which mdtheme) && "$binary" --write'

[tasks."readme:pre-push"]
description = "Guard pushes with the project's installed mdtheme version"
shell = "bash -c"
env = { MISE_OFFLINE = "true" }
run = 'binary=$(mise which mdtheme) && "$binary" pre-push'
```

The tasks require Bash; on Windows, Git Bash provides it. Put your authored
Markdown in `README.md.src`, and add `mdtheme.yaml` if you want themes or badges.
Then review and trust the tool configuration, generate the lockfile, and install:

```sh
mise trust
mise lock --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64
mise install --locked
mise run readme:write
```

Review and commit `mise.toml`, `mise.lock`, `README.md.src`, the generated
`README.md`, and any mdtheme configuration or local theme files. The lockfile
records the selected archives and checksums; setup verifies them before installing.
No global mdtheme installation or Node manifest is needed.

The current release includes Windows AMD64, Linux ARM64/AMD64 with GNU libc,
and macOS ARM64/AMD64. Linux binaries target Ubuntu 24.04 or newer.

## Set up an existing checkout

When the repository already contains the config and lockfile, review its tool
configuration, then run:

```sh
mise trust
mise install --locked
```

This does not enable Git hooks or rewrite shell profiles.

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

## Use the same pin in GitHub Actions

After checking out your repository, add these steps to a job:

```yaml
- name: Install project tools
  uses: jdx/mise-action@5228313ee0372e111a38da051671ca30fc5a96db # v3
  with:
    version: 2026.9.5
    install_args: --locked
- name: Check README
  run: mise run readme:check
```

The action installs the version from your committed tool files. It does not
choose a separate mdtheme version for CI. Python is only used by mdtheme's own
integration tests; consuming projects do not need it for these steps.

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
