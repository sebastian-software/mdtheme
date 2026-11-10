# README tooling ownership

The project owns its native configuration and verification scripts. Shared
infrastructure guidance lives in
[project-infra](https://github.com/sebastian-software/project-infra); it does not
install tooling or run a second repository gate.

mdtheme owns YAML validation, theme fetching, badge composition, and exact
generated-output checks. Keep authored content in `README.md.src`, theme
selection in `mdtheme.yaml`, and the generated `README.md` committed. Run
`sh scripts/check.sh` to check the source build, generated READMEs, and installed
Cargo package. No metadata stamp is read by these tools.

## Project-owned CLI version

Each repository pins mdtheme independently in `mise.toml` and commits its
five-platform `mise.lock`. Setup and CI explicitly run `mise install --locked`.
README tasks resolve the installed project version, disable automatic
installation, and reject system fallback. Shared infrastructure updates do not
upgrade the project's CLI. See [project tools](project-tools.md) for commands
and [ADR 0010](adr/0010-distribute-native-release-binaries.md) for the decision.

For shared badge slots, use mdtheme 0.4.0 or newer. Upgrade the CLI pin and
lockfile before adopting a theme that supplies `badges-prepend.md`. The
[theme guide](theme-authoring.md#add-badges-to-the-project-badge-row) explains
source markers and nesting. Theme selection and authored badge rows remain
project-owned.

## History

The JavaScript implementation needed a narrow standards 0.10 ownership patch.
The native port initially outpaced that checker; standards 0.11 resolved the
YAML ownership gap. The standards CLI and metadata stamp are retired. Historical
patches and the scoped mise pilot remain in Git history; they are not
requirements for installing or developing the native CLI.
