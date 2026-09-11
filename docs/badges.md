# Project badges

Enable project badges in `mdtheme.yaml` to read local manifests and add a badge
row immediately before the source. Badge generation does not contact a registry.

```yaml
badges:
  enabled: true
  published: false
```

The config directory is the project root for metadata discovery. `enabled`
defaults to `false`; `published` defaults to `true`. Enable badges explicitly
and set `published: false` while packages are unpublished.

## What it discovers

mdtheme reads `package.json` and `Cargo.toml` under the config directory. It
prefers a public root package in each ecosystem. If there is no public root
package, it follows npm and pnpm workspace declarations and Rust workspace
members/default members. Rust package metadata inherits the
workspace `rust-version` and repository when the member opts in with
`rust-version.workspace = true` or `repository.workspace = true`.

The standard set appears in this order:

1. For each selected published package: its registry version, downloads, and
   docs.rs link when it is a Rust library.
2. GitHub Actions status from `ci.yml` or `ci.yaml`, otherwise the only available
   workflow. With several other workflows, CI is omitted until `workflow`
   selects one.
3. Runtime requirements from the selected package manifests.
4. Declared package licenses, linked to their local manifests.

npm downloads use the monthly count (`npm/dm`). crates.io downloads use the
registry's recent count (`crates/dr`), labeled separately rather than implying
both registries report the same period. Each version, download, and docs.rs
badge names its package.

A Rust library is discovered from `src/lib.rs` or an explicit `[lib].path`.
`[lib].doc = false` suppresses its docs.rs badge. `package.autolib = false`
disables implicit library discovery. Binary-only packages do not receive a
docs.rs badge. Local discovery cannot verify that the published documentation
build succeeded; the badge service supplies that status.

Licenses come from string-valued `package.json` license fields and Cargo
`package.license`, including explicit `license.workspace = true` inheritance.
The declared expression is preserved, including dual licenses. Missing or
empty values are omitted; npm workspace members do not inherit the root
license implicitly. A `license-file` without a declared license expression is
not interpreted. With multiple packages, each license badge identifies its
registry and package, so different licenses are never presented as one
repository-wide license.

Codecov, coverage thresholds, GitHub releases, bundle sizes, and toolchain or
platform claims are outside this standard set. Brand attribution belongs in
the brand theme. See the [badge decision](adr/0007-use-a-fixed-project-badge-set.md).

Registry image URLs are dynamic badge URLs, but mdtheme never checks
whether a package has been published. The default `published: true` assumes
the selected packages exist on their registries. Set `published: false` while
the project is unpublished; runtime, CI, and license badges remain available.
Version, download, and docs.rs badges are all hidden.

## Selection and exclusions

Use `packages` when a workspace has more than one user-facing package or its
public package cannot be inferred:

```yaml
badges:
  enabled: true
  packages:
    - packages/cli/package.json
    - crates/engine/Cargo.toml
  published: false
  workflow: ci.yml
```

Manifest paths are relative to the config directory. mdtheme skips packages
marked `private: true` in npm or excluded from crates.io publication in Cargo,
and platform-specific npm `os`, `cpu`, or `libc` variants. Default workspace
discovery also skips optional dependency targets;
an explicit `packages` entry can select a public optional package intentionally.
Explicit package paths are validated so a typo is reported instead of silently
producing a partial set.

Badge generation is deterministic and offline. It does not use the clock, fetch
metadata, or probe registry availability. Malformed JSON, TOML, or YAML and
unreadable explicit package paths produce an input error.

## Theme order

Selected themes are supplied outermost first and closed in reverse order.
Enabled badges appear after all theme headers and immediately before the
project source, or in an explicit badge slot in the source. Brand attribution
belongs in a theme’s `badges-prepend.md` or `badges-append.md`. See
[theme badge composition](theme-authoring.md#add-badges-to-the-project-badge-row)
for placement, ordering, and authored badges.

Badges are Markdown images and links. They do not install CSS, fonts, or a
website layout; the host renders the document with its own styles.
