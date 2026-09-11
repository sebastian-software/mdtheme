# Standards integration

The TypeScript implementation used `@sebastian-software/standards@0.10.0` with a
narrow pnpm patch for explicit README ownership. That bridge came from
[standards PR #81](https://github.com/sebastian-software/standards/pull/81), commit
`30d7215`, plus local mdtheme rename adjustments.

The native port removes the Node dependency, pnpm patch, and Node-specific
validation path. The old bridge is historical context, not a requirement for
running or developing the Rust CLI. Git history retains the patch if an older
JavaScript revision needs maintenance.

`README.md.src` and `mdtheme.yaml` now define this repository's README generation.
The generated file remains owned by mdtheme. Do not introduce another tool that
rewrites its framing. Native checks are documented in [maintaining mdtheme](maintaining.md).

Existing standards-managed files and marker sections remain subject to their
repository guardrails. A future Rust standards integration should use the
supported upstream configuration and preserve mdtheme's README ownership;
it should not restore the old npm dependency solely to run README generation.

The Rust standards reference files have been applied. The current standards 13
README ownership check still expects an npm dependency and a TypeScript config.
It does not recognize the native YAML setup yet. That upstream incompatibility
remains unresolved; the repository gate uses Cargo and mdtheme's own README
check rather than claiming standards consistency passes.

## Native installation contract

Each project chooses its mdtheme version independently of standards. Homebrew
remains useful for personal, unpinned use, but an arbitrary CLI on PATH is not a
project version contract. Store only the version configuration and any tool
lockfile in the repository; keep installed binaries outside it.

Installation belongs in an explicit setup step. Checks must fail when the
project's exact version is missing or mismatched. They must not download a tool
or fall back to an unrelated system installation. These constraints are recorded
in [ADR 0010](adr/0010-distribute-native-release-binaries.md).

## Project version proposal

Status: scoped pilot implemented on 2026-09-11; organization-wide adoption
and the upstream standards implementation remain pending.
See [project tools](project-tools.md) for executable setup and checks.

### Existing conventions

The local standards checkout at `418631b` defines managed, seeded, and reference
files separately. Seeded files become repository-owned; Rust CI is a reference
rather than an exact managed workflow. Its change 0011 requires exact tool pins.
Rust consumers run standards through a version-pinned `pnpm dlx` command without
adding a package manifest solely for that tool.

Dalo, Ferrocat, and Ferromark also pin tools in CI. Examples include Dalo's
`cross`, `cargo-deny`, and `cargo-llvm-cov`, and Ferrocat's `cargo-public-api`.
Inspection of these repository roots, standards, and the macOS setup Brewfile
found no shared mise, asdf, or aqua convention. This is a scoped finding, not an
audit of every organization repository.

The local standards checkout has an unfinished merge affecting CI references.
It was inspected without changing its files or Git state. The earlier README
ownership bridge is still a separate integration concern; adopting a tool
manager does not make that bridge compatible with YAML.

### Recommended pilot

Use mise's built-in GitHub backend for mdtheme only. Do not migrate Rust, Node,
or every development tool as part of this pilot. An illustrative project pin is:

```toml
[tools."github:sebastian-software/mdtheme"]
version = "0.3.1"
version_prefix = "mdtheme-v"
```

The project now commits this pin and a lockfile covering all five release
platforms. Local tests exercise the real macOS ARM64 binary. The pilot CI
exercises installation on Linux, macOS, and Windows. Other architecture entries
are locked to published checksums; generating a lock entry is not execution
evidence for that architecture.
Do not add a second authoritative version field to `mdtheme.yaml` or
`.repometa.json`. Theme revisions remain independent of the CLI version.

Setup uses `mise install --locked`. README and pre-push tasks resolve an absolute
path with `mise which`, then run it with mise network access disabled. The
project disables automatic installation and system fallback. Local fixture tests
verified missing-version rejection, no global fallback, checksum rejection,
offline generation, and pre-push behavior. A second usable native release is
not yet available, so successful two-version coexistence remains unverified.

### Standards responsibilities

- Seed a project-owned tool configuration only when opting into mdtheme. Preserve
  existing pins and unrelated tools on later `apply` runs.
- Validate YAML README ownership and an exact project pin without depending on
  npm scripts or TypeScript configuration.
- Keep `standards check` focused on static repository consistency. Run native
  README generation checks in a separate explicit step using the same resolver
  as local commands and pre-push.
- Provide CI reference steps that install the project's pin. Pin the setup action
  by commit and the mise executable version independently of mdtheme.
- Add dependency-update automation after proving the pin and lockfile update
  together. A standards upgrade must not silently upgrade mdtheme.

### Alternatives

| Option | Tradeoff |
| --- | --- |
| mise pilot | Adds one setup tool; reuses existing multi-version installation and resolution. |
| Versioned installer directories and a custom launcher | Reuses our installer, but makes us own resolution, concurrency, platform behavior, and cache maintenance. |
| Global Homebrew installation | Simple personal setup; does not meet independent project version requirements. |
| Binary bundled with standards | Couples tool and standards releases and does not meet project-owned version requirements. |

### Pilot acceptance criteria

1. Two fixture projects select distinct real mdtheme releases in the same user
   account without overwriting one another. Report if a second usable release
   is not available; do not fabricate version-isolation evidence.
2. Linux, macOS, and Windows select the expected published asset. Verify lockfile
   checksums and reject an altered archive.
3. Missing installation fails without a download, even with another mdtheme on
   PATH. An installed version runs without contacting the tool registry. Git
   themes may still fetch their configured revision as required by mdtheme.
4. Local README commands, pre-push, and CI select the same version. mdtheme's own
   source tests and packaged-consumer checks continue using the current Cargo
   build, so a released CLI cannot hide regressions in new source changes.
5. `standards apply` preserves a project's pin, and static `standards check`
   detects invalid ownership/configuration without invoking installers.

Implement the pilot in an isolated branch, then adapt standards PR #81 from a
clean checkout after accounting for its existing work. The current investigation
does not resolve the unrelated local merge or authorize a broad tooling migration.

### Sources

- [Standards change 0011](https://github.com/sebastian-software/standards/blob/418631b/changes/0011-pin-standards-cli.md)
- [Standards Rust reference](https://github.com/sebastian-software/standards/blob/418631b/reference/rust/README.md)
- [mise GitHub backend](https://mise.jdx.dev/dev-tools/backends/github.html)
- [mise execution](https://mise.jdx.dev/cli/exec.html)
- [mise settings, including automatic installation](https://mise.jdx.dev/configuration/settings.html#auto_install)
- [mise CI integration](https://mise.jdx.dev/continuous-integration.html)
