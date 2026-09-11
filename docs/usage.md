# Usage

`mdtheme` keeps authored Markdown separate from the generated README. Install
the native CLI with [Homebrew, the installer, or Cargo](installation.md).
Git is required for remote themes and `pre-push`. Local generation needs only
the installed binary; no Node runtime or project `package.json` is required.

## Configure a project

Create `mdtheme.yaml` in your project directory:

```yaml
source: README.md.src
output: README.md
themes:
  - directory: .mdtheme/company
badges:
  enabled: true
  published: false
```

All top-level fields are optional. Without a config, mdtheme uses `README.md.src`,
`README.md`, no themes, and no badges. Discovery checks `mdtheme.yaml` and
`mdtheme.yml` in the current directory. Having both is an error. Use
`--config PATH` to select a config explicitly, including one in a subdirectory.

Source and output live beside the config. `source` is a simple basename that
starts with an ASCII letter or number and then uses letters, numbers, `.`, `_`,
or `-`. `output` must be `README.md`. Unknown config fields are errors.
Configuration contains data only; JavaScript and TypeScript configs are no
longer supported.

Local theme directories are relative to the config. A theme entry selects either
`directory` or `git`; Git entries also accept `ref` and `path`. See
[theme authoring](theme-authoring.md) for the format and remote behavior, and
[project badges](badges.md) for the `badges` fields.

## Write and check

```sh
mdtheme --write
mdtheme --check
```

Write mode atomically replaces the output when it differs. An unchanged output
is left alone. The source is never rewritten. Paths are validated before writing;
source/output aliases and output symlinks are rejected.

Source and frame text keep their original whitespace and line endings. The
renderer adds a generated-file notice and LF blank-line boundaries between
nonempty sections. It does not format Markdown or add a final newline.

Check mode computes the same result and compares it with the output. It never
writes the source or README. Both modes fetch configured Git themes into temporary
directories outside the worktree and remove them afterward. A failed fetch is an
error, even if the README was generated successfully on an earlier run.

| Status | Meaning |
| ---: | --- |
| 0 | The requested operation succeeded; a check found current output. |
| 1 | Check found missing or stale output, or pre-push blocked pending changes. |
| 2 | Arguments, configuration, paths, Git access, or generation failed. |

Errors are reported on stderr. See `mdtheme --help` for accepted commands.
The [pre-push guide](pre-push.md) explains the additional Git checks.

## Check in CI

Install a pinned mdtheme version with the [GitHub Actions example](installation.md#github-actions),
then run `mdtheme --check` from the project directory. Remote themes follow their configured ref:
a moving branch can make a check fail without any project source change. Run
`mdtheme --write`, review the new branding, and commit it to resolve that drift.
Choose a commit hash in `ref` when you want the theme to remain fixed.

## Compose text in Rust

The Rust library composes strings without reading files or fetching themes:

```rust
use mdtheme::{Frame, render};

fn main() -> anyhow::Result<()> {
    let frames = [Frame {
        opening: "> Part of the Example project.\n".into(),
        closing: "Questions? Open an issue.\n".into(),
        ..Frame::default()
    }];
    let markdown = render("# Example\n", &frames, "README.md.src")?;
    println!("{markdown}");
    Ok(())
}
```

Until registry publication, use a local path dependency on a checkout of mdtheme.
The example also needs `anyhow` in the consuming crate. `render` returns
`anyhow::Result<String>` and validates the source name used in the notice.
Frames are supplied outermost first and closed in reverse order.

## Git line endings

Generation preserves authored line endings and adds LF section boundaries.
If Git converts your generated README on checkout, check mode can report drift.
Keep its bytes unchanged with a `.gitattributes` rule such as `README.md -text`,
or use `* text=auto eol=lf` when your repository standardizes text on LF.
