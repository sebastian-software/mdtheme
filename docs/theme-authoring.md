# Theme authoring and Git sources

A theme is a directory containing any of `header.md`, `footer.md`,
`badges-prepend.md`, and `badges-append.md`. The files
contain literal UTF-8 Markdown or HTML. mdtheme places the header before the
source and the footer after it. It does not execute scripts or expand placeholders.

For a local theme, create `.mdtheme/company/header.md` with your opening text,
then select it in `mdtheme.yaml`:

```yaml
themes:
  - directory: .mdtheme/company
```

Paths are relative to the config directory. Commit local theme files alongside
your source. At least one of these files must exist; empty files are allowed.

## Share a theme through Git

Put the same files in a Git repository. Use its URL in the config; the repository
below is a placeholder for your own theme:

```yaml
themes:
  - git: https://github.com/example/readme-theme.git
    ref: main
    path: markdown
```

`git` identifies the repository. `ref` defaults to `main` and accepts branches,
tags, commit hashes, and revisions Git can resolve from the fetched repository.
`path` is optional; omit it when the theme files are at the repository root.
The selected directory and files must stay inside the checkout. Submodules are
not fetched.

mdtheme uses the installed Git command and your normal Git authentication.
Private repositories must be accessible in the environment running mdtheme,
including CI. Git terminal prompts are disabled, so configure credentials before
running the command. Prefer your existing credential helper or SSH setup over embedding
credentials in config URLs.

Each write, check, or clean pre-push invocation fetches the requested revision
into a temporary directory outside the project. It tries a shallow fetch first
and falls back to full history when needed to resolve the revision. Temporary
files are removed after generation. There is no persistent cache, offline
fallback, or theme lockfile. An unavailable repository or revision fails the
command and leaves the existing README untouched.

Following `main` is supported and is the default. New commits become visible on
the next run. Tags offer a named release but can also move. Use a full commit
hash when a fixed revision matters. mdtheme leaves that choice to the project.

## Boundaries and nesting

Themes are supplied outermost first and closed in reverse order:

```yaml
themes:
  - directory: themes/outer
  - directory: themes/inner
```

The result contains the outer header, inner header, source, inner footer, and
outer footer. Enabled project badges appear immediately before the source,
inside all selected themes.

Outside explicit badge slots, source and frame text are preserved, including line endings and trailing
whitespace. The renderer supplies LF blank-line boundaries between nonempty
parts. It does not normalize existing line endings or add a final newline.
Authors control formatting and whether their Markdown or HTML wrappers render
correctly on the target host.

## Try the example

The [neutral example](../examples/neutral) includes two local themes and a YAML
config. With the native CLI installed, run:

```sh
cd examples/neutral
mdtheme --write
mdtheme --check
```

The nested details and notice frames demonstrate boundaries without a theme
package or script runtime. The [Rust API](usage.md#compose-text-in-rust) also
lets you test frames as strings.

## Add badges to the project badge row

Put brand badges in `badges-prepend.md` to place them before project badges,
or `badges-append.md` to place them after. These files contain literal inline
Markdown or HTML, just like an authored badge row. A badge-only theme is valid.
Move a badge out of `header.md` when adopting this feature to avoid duplicates.

In `README.md.src`, mark the row where badges belong:

```markdown
# My project

<!-- mdtheme:badges:start -->
[![Build](https://example.com/build.svg)](https://example.com/build)
<!-- mdtheme:badges:end -->

Your project description goes here.
```

The generated README replaces the marker pair with one row: outer theme
prepends, inner theme prepends, enabled metadata badges, authored badges,
inner theme appends, then outer theme appends. An empty pair places generated
badges without any authored badges. Theme badges work even when
`badges.enabled` is false; that switch controls only metadata discovery.

Without markers, the combined generated row appears after all headers and
before the source. Existing authored badges elsewhere are not detected or moved.
Only one ordered marker pair is allowed. Missing, reversed, or duplicate
markers fail before writing. Marker strings are reserved, including in code
examples in the source; link to this guide instead of quoting them there.

The renderer trims the outside whitespace of each badge fragment and the
marked row, then joins nonempty parts with a space. Interior text and all source
outside the markers retain their bytes. The source file is never rewritten.
Use inline content without blank paragraphs. For HTML badge containers, use
HTML fragments throughout or move the row outside the container: GitHub does
not render Markdown badge syntax inside every HTML block. mdtheme does not
convert between HTML and Markdown or deduplicate badges.

Rust callers can use `Frame.badges_prepend` and `Frame.badges_append` with
`..Frame::default()` for omitted fields.
