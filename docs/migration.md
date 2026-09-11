# Migrate from the TypeScript implementation

The native implementation replaces the early npm CLI, executable configs, and
JavaScript library API. This is a breaking change. Historical npm releases and
Git revisions keep their original behavior; the new CLI does not load them.

## Install the native CLI

Build and install from a checkout using the [README instructions](../README.md#get-started).
Check `mdtheme --version` from your project directory to confirm which binary
your shell selects. Remove the old mdtheme npm dependency and replace `npx mdtheme`
or npm-only wrapper scripts with direct `mdtheme` calls. Keep other Node tooling
if your project uses it.

## Replace config and factories

Create `mdtheme.yaml` beside `README.md.src`. Replace TypeScript frame factories
with directories containing literal `header.md` and `footer.md` files:

```yaml
themes:
  - directory: .mdtheme/company
badges:
  enabled: true
  published: false
```

Move each factory's resulting opening and closing Markdown into those files.
Translate dynamic project badges to the `badges` object; mdtheme reads the
manifests itself. Arbitrary script logic and template interpolation have no
native equivalent. Resolve such content into Markdown or generate the source
with your own separate tooling.

For a shared theme, publish those files in its Git repository and use a `git`
entry with an optional `ref` and `path`. An existing npm theme package cannot
be used unchanged unless it also includes these Markdown files. See
[theme authoring](theme-authoring.md) for the layout and fetch behavior.

Remove the old `mdtheme.config.ts`, `.mts`, `.js`, or `.mjs` file after migrating.
If only an old config exists, the CLI reports a migration error rather than
silently generating an unthemed README.

## Verify and update automation

```sh
mdtheme --write
mdtheme --check
```

Review the README diff, then commit the YAML config, local theme files, source,
and generated README together. Source formatting, frame order, and exit statuses
remain the same. Replace Node installation steps in your README job with native
CLI installation. Update the [pre-push hook](pre-push.md) to call `mdtheme pre-push`.

The JavaScript `renderMarkdown` and `defineConfig` exports are removed. Rust
consumers can use [`mdtheme::render`](usage.md#compose-text-in-rust). Other build
systems can invoke the CLI.

To roll back during evaluation, restore your previous config, dependency lockfile,
and generated README from Git and use the previous npm version. Do not mix the
old configuration with the native CLI.

Workspace discovery supports standard `*`, `**`, `?`, and character-class glob
patterns, with leading `!` exclusions. Extended Node brace/extglob patterns are
reported as unsupported; use explicit `badges.packages` manifest paths instead
of relying on a partial match.
