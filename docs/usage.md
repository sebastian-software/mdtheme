# Usage

`markdown-themer` keeps an authored Markdown source separate from the output
file that a repository publishes. The default pair is `README.md.src` and
`README.md`; both names can be set in a config.

## Install from source or a tarball

The package requires Node.js 24 or newer. Until it is published to npm, install
it from a checked-out repository or a packed artifact:

```sh
git clone https://github.com/sebastian-software/markdown-themer.git
cd markdown-themer
pnpm install
pnpm build
cd /path/to/consumer
npm install --save-dev /path/to/markdown-themer
```

For a tarball, run `npm pack` in the repository, then install the resulting file
from the consumer project:

```sh
cd /path/to/markdown-themer
npm pack
cd /path/to/consumer
npm install --save-dev /path/to/markdown-themer/markdown-themer-0.1.0.tgz
```

A published package can later be installed with its package name.

## A project config

The config is ordinary trusted local TypeScript or JavaScript. It can import
functions from files in the project and return the public `MarkdownFrame`
values:

```ts
// markdown-themer.config.ts
import { defineConfig } from "markdown-themer";
import { noticeFrame } from "./themes.ts";

export default defineConfig({
  source: "README.md.src",
  output: "README.md",
  themes: [noticeFrame("Maintainer note")],
});
```

`source` and `output` are paths relative to the config file. If no config is
provided, the CLI discovers one of these names in the current directory:

```text
markdown-themer.config.ts
markdown-themer.config.mts
markdown-themer.config.js
markdown-themer.config.mjs
```

Multiple discovered configs are an error. `--config PATH` selects one config
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
npx markdown-themer --write
```

The command reads the source, applies frames, formats the complete Markdown,
and atomically updates the output. It validates paths before writing, including
the source and output being the same file or hard link. The source remains
untouched.

Use check mode in CI and in a pre-merge check:

```sh
npx markdown-themer --check
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
import { renderMarkdown } from "markdown-themer";
import type { MarkdownFrame } from "markdown-themer";

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
    "readme:write": "markdown-themer --write",
    "readme:check": "markdown-themer --check"
  }
}
```

Commit `README.md.src`, the config, the local factories, and the generated
`README.md`. Review source changes and regenerate the output before committing.
