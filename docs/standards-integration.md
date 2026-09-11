# Standards integration

Standards 0.11 and newer recognizes `readme.owner: mdtheme` in
`.repometa.json`. A native project needs `README.md.src`, a single
`mdtheme.yaml` or `mdtheme.yml`, and the generated README notice. No npm
dependency, TypeScript configuration, or npm script is required for ownership.

Standards checks static repository consistency. mdtheme owns YAML validation,
theme fetching, badge composition, and exact generated-output checks. Keep
standards-managed files and marker sections under their existing guardrails.

## Project-owned CLI version

Each repository pins mdtheme independently in `mise.toml` and commits its
five-platform `mise.lock`. Setup and CI explicitly run `mise install --locked`.
README tasks resolve the installed project version, disable automatic
installation, and reject system fallback. A standards upgrade does not upgrade
the project's CLI. See [project tools](project-tools.md) for commands and
[ADR 0010](adr/0010-distribute-native-release-binaries.md) for the decision.

For shared badge slots, use mdtheme 0.4.0 or newer. Upgrade the CLI pin and
lockfile before adopting a theme that supplies `badges-prepend.md`. The
[theme guide](theme-authoring.md#add-badges-to-the-project-badge-row) explains
source markers and nesting. The standards package provides an opt-in
`reference/mdtheme/README.md` guide rather than rewriting project-owned pins
or authored badge rows during `apply`.

## History

The JavaScript implementation needed a narrow standards 0.10 ownership patch.
The native port initially outpaced that checker; standards 0.11 resolved the
YAML ownership gap. Historical patches and the scoped mise pilot remain in Git
history. They are not requirements for installing or developing the native CLI.
