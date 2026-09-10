# Project badges

`projectBadges` is a Markdown frame factory for repository metadata. It reads
local manifests and returns ordinary opening/closing Markdown fragments; it
does not contact a registry or inspect the network.

```ts
import { defineConfig, projectBadges } from "markdown-themer";

export default defineConfig({
  themes: [projectBadges(import.meta.url, { published: false })],
});
```

Pass the config module's `import.meta.url` when the config is at the project
root. Pass a directory path for a filesystem root, or a file URL for the
config module. The frame is usually the
innermost theme in the stack, after a brand header and immediately before the
project source, so its badges introduce the corpus without wrapping the rest
of the document.

## What it discovers

The factory reads `package.json` and `Cargo.toml` under the supplied root. It
prefers a public root package in each ecosystem. If there is no public root
package, it follows npm and pnpm workspace declarations and Rust workspace
members/default members. Rust package metadata inherits the
workspace `rust-version` and repository when the member opts in with
`rust-version.workspace = true` or `repository.workspace = true`.

The selected package metadata supplies version links for npm and crates.io,
local runtime badges from supported versions, and a GitHub Actions badge from
`ci.yml` or `ci.yaml`, otherwise the only available workflow. With several
other workflows it omits CI until `workflow` selects one.

Registry image URLs are dynamic badge URLs, but the factory never checks
whether a package has been published. The default `published: true` assumes
the selected packages exist on their registries. Set `published: false` while
the project is unpublished; runtime and CI badges remain available. When more
than one package is selected, each registry badge carries its package name so
the links remain distinguishable.

## Selection and exclusions

Use `packages` when a workspace has more than one user-facing package or its
public package cannot be inferred:

```ts
projectBadges(import.meta.url, {
  packages: ["packages/cli/package.json", "crates/engine/Cargo.toml"],
  published: false,
  workflow: "ci.yml",
});
```

Manifest paths are relative to the supplied root. The factory skips packages
marked `private: true` in npm or excluded from crates.io publication in Cargo,
and platform-specific npm `os`, `cpu`, or `libc` variants. Default workspace discovery also skips optional dependency targets;
an explicit `packages` entry can select a public optional package intentionally.
Explicit package paths are validated so a typo is reported instead of silently
producing a partial set.

Rendering is deterministic and offline. It does not use the clock, fetch
metadata, or probe registry availability. Malformed JSON, TOML, or YAML and
unreadable explicit package paths produce an input error.

## Theme order

Themes are supplied outer-first and closed in reverse order. Put a brand frame
first, `projectBadges` next, and let the source corpus follow:

```ts
themes: [
  brandFrame(),
  projectBadges(import.meta.url, { published: false }),
],
```

The project frame contributes only Markdown. It cannot install CSS, fonts, or
a website layout on GitHub; the host renders the resulting Markdown with its
own styles.
