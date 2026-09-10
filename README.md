# markdown-themer

`markdown-themer` turns a Markdown source document into a checked, consistently
formatted output file. It is useful when a repository keeps an authored
`README.md.src` and wants `README.md` to be reproducible in local development
and CI.

The tool works on Markdown text. A theme is a small pair of strings: one string
opens a frame around the document and one string closes it. Themes add those
boundaries around ordinary Markdown source; the complete result is then
formatted with the package's pinned Markdown formatter.

## Install

The package requires Node.js 24 or newer. The package is currently consumed
from its source repository or a local tarball:

```sh
git clone https://github.com/sebastian-software/markdown-themer.git
cd markdown-themer
pnpm install
pnpm build
cd /path/to/consumer
npm install --save-dev /path/to/markdown-themer
```

To install a packed artifact, run `npm pack` in the checked-out repository,
then install the resulting `.tgz` file from the consumer project:

```sh
cd /path/to/markdown-themer
npm pack
cd /path/to/consumer
npm install --save-dev /path/to/markdown-themer/markdown-themer-0.1.0.tgz
```

When the package is published, the same dependency can be installed by name.

## Quick start

Create `README.md.src` with the Markdown you want to edit. Add a local config:

```ts
// markdown-themer.config.ts
import { defineConfig } from "markdown-themer";
import { detailsFrame } from "./theme-factory.ts";

export default defineConfig({
  source: "README.md.src",
  output: "README.md",
  themes: [detailsFrame("Project notes")],
});
```

Factories are ordinary local TypeScript functions. For example:

```ts
// theme-factory.ts
import type { MarkdownFrame } from "markdown-themer";

export function detailsFrame(summary: string): MarkdownFrame {
  return {
    opening: `<details>\n<summary>${summary}</summary>\n\n`,
    closing: "\n</details>\n",
  };
}
```

Generate the output and then check it in CI:

```sh
npx markdown-themer --write
npx markdown-themer --check
```

Edit `README.md.src`; do not edit generated `README.md` by hand. The write
operation computes the complete result before replacing the output. The check
operation is read-only and exits with status 1 when the output is out of date.

## CLI

```text
markdown-themer --write [--config PATH]
markdown-themer --check [--config PATH]
markdown-themer --help
markdown-themer --version
```

With no `--config`, the CLI looks in the current directory for one of
`markdown-themer.config.ts`, `.mts`, `.js`, or `.mjs`. Pass an explicit path
when the config lives elsewhere. Source and output paths in a config resolve
from the config file's directory.

`--write` returns 0 after writing a valid output. `--check` returns 0 when the
output matches, 1 when it differs, and 2 for invalid arguments or input. A
configuration file is trusted local code: a TypeScript config is loaded and
executed so it can import ordinary theme factories. Keep configs in the
repository and review them like any other build script.

## Theme boundaries

The public API is deliberately small:

```ts
import { defineConfig, renderMarkdown } from "markdown-themer";
import type { MarkdownFrame } from "markdown-themer";
```

`renderMarkdown(source, themes)` receives Markdown text and returns the framed
Markdown. Themes are applied in array order; their closing strings are emitted
in reverse order. Empty opening or closing strings are valid. See
[`docs/theme-authoring.md`](docs/theme-authoring.md) for boundary guidance and
[`examples/neutral`](examples/neutral) for complete local factories.

The package has no React or web rendering dependency. A React application can
use its own components elsewhere and keep Markdown framing in this package's
plain string factories.

## More documentation

- [Usage and CI](docs/usage.md)
- [Authoring theme factories](docs/theme-authoring.md)
- [Neutral examples](examples/neutral)

---

<!-- sebastian-software-branding:start -->

<p align="center">
  <a href="https://oss.sebastian-software.com">
    <img src="https://sebastian-brand.vercel.app/sebastian-software/logo-software.svg" alt="Sebastian Software" width="240" />
  </a>
</p>

<p align="center">
  <strong>Built by Sebastian Software</strong> — consulting for TypeScript, React &amp; Rust.<br />
  <a href="https://sebastian-software.de">Work with us</a> · <a href="https://oss.sebastian-software.com">More open source</a>
</p>

<p align="center">Copyright &copy; 2026 Sebastian Software GmbH</p>

<!-- sebastian-software-branding:end -->
