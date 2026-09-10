# Usage

`mdtheme` keeps an authored Markdown source separate from the output
file that a repository publishes. The default pair is `README.md.src` and
`README.md`. A config can change the source filename; CLI output is always
named `README.md`.

## Install

The package requires Node.js 24 or newer.

```sh
npm install --save-dev mdtheme
```

For a local checkout, run `pnpm install` and `npm pack`, then install the
resulting `mdtheme-0.1.0.tgz` from the consumer project.

## A project config

The config is ordinary trusted local TypeScript or JavaScript. It can import
functions from files in the project and return the public `MarkdownFrame`
values:

```ts
// mdtheme.config.ts
import { defineConfig } from "mdtheme";
import { noticeFrame } from "./themes.ts";

export default defineConfig({
  source: "README.md.src",
  output: "README.md",
  themes: [noticeFrame("Maintainer note")],
});
```

`source` and `output` are paths relative to the config file. Both files must
be in that directory, and `output` must be named `README.md`. If no config is
selected explicitly, the CLI discovers one of these names in the current directory:

```text
mdtheme.config.ts
mdtheme.config.mts
mdtheme.config.js
mdtheme.config.mjs
```

When no config is found, the CLI uses `README.md.src`, `README.md`, and no
themes. Multiple discovered configs are an error. `--config PATH` selects one config
explicitly. The config loader supports TypeScript on Node.js 24 and newer.
The source basename is included in the generated notice and must use only a
letter or number first, followed by letters, numbers, `.`, `_`, or `-`.
Choose a simple source basename such as `README.md.src`.

The config object has three fields:

```ts
type Config = {
  source?: string;
  output?: string;
  themes: readonly MarkdownFrame[];
};
```

Unknown fields are diagnosed. Use `defineConfig` for editor type checking and
early validation.

## Write and check

Run the writer from the project directory:

```sh
npx mdtheme --write
```

The command reads the source, applies frames, formats the complete Markdown,
and atomically updates the output. It validates paths before writing, including
the source and output being the same file or hard link. The source remains
untouched.

Use check mode in CI and in a pre-merge check:

```sh
npx mdtheme --check
```

Check mode never writes. Its exit statuses are:

| Status | Meaning                                                                      |
| -----: | ---------------------------------------------------------------------------- |
|      0 | The operation succeeded; in check mode, output matches the computed content. |
|      1 | Check mode found output drift.                                               |
|      2 | Arguments, config, paths, or input are invalid.                              |

`--write` and `--check` each require exactly one operation. `--help` and
`--version` are read-only informational commands.

The generated output includes a static notice directing editors to the source.
It contains no timestamp or network data, so the same source and config produce
the same bytes.

## Direct API use

For a build script that already has the source text, use the package root:

```ts
import { renderMarkdown } from "mdtheme";
import type { MarkdownFrame } from "mdtheme";

const frames: readonly MarkdownFrame[] = [{ opening: "<section>\n", closing: "\n</section>\n" }];

const output = await renderMarkdown("# Hello\n", frames, {
  sourceName: "README.md.src",
});
```

This API accepts Markdown text and returns Markdown text. It does not read or
write files and does not discover formatter configuration or arbitrary plugins.

## Keeping React separate

The package's contract is Markdown-only: themes are string factories and the
renderer returns a string. A React site or component library can continue to
own its own UI, CSS, and component rendering without being coupled to this
package. If a project uses React, keep that code outside its Markdown frame
factories.

## A typical package script

```json
{
  "scripts": {
    "readme:write": "mdtheme --write",
    "readme:check": "mdtheme --check"
  }
}
```

Commit `README.md.src`, the config, the local factories, and the generated
`README.md`. Review source changes and regenerate the output before committing.
