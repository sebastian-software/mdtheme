# Authoring theme factories

A theme is a `MarkdownFrame`:

```ts
export type MarkdownFrame = {
  opening: string;
  closing: string;
};
```

Opening and closing strings are plain Markdown or HTML text. They are literal
frame boundaries; theme code does not transform the source document. A factory
is simply a function that returns a frame:

```ts
import type { MarkdownFrame } from "mdtheme";

export function noticeFrame(label: string): MarkdownFrame {
  return {
    opening: `> **${label}**\n>\n`,
    closing: "\n",
  };
}
```

Use the public package root for imports. Factories do not need a plugin
manifest, registration call, React component, or web runtime.

## Boundaries and order

The renderer emits frames in array order and closes them in reverse order. This
makes the first frame the outermost frame:

```ts
const themes = [outerFrame(), innerFrame()];
// opening: outer, inner
// source
// closing: inner, outer
```

An empty `opening` or `closing` is valid. Include deliberate newlines at the
boundary so the source's first heading and last paragraph remain valid Markdown
inside the frame. The renderer supplies blank-line section boundaries between
nonempty frame parts and the source; indentation and newlines that belong
inside your Markdown or HTML fragment remain the factory's responsibility. Keep
a source's final newline in the source file; the formatter normalizes the
complete result.

HTML wrappers should be valid around the Markdown they contain. A wrapper that
opens a raw HTML block and never closes it can change how a renderer treats all
following content. If a value comes from a project setting, escape it before
placing it in an HTML attribute or tag.

## Neutral examples

This repository includes small, dependency-free factories in
[`examples/neutral/theme-factory.ts`](../examples/neutral/theme-factory.ts):

```ts
import { defineConfig } from "mdtheme";
import { detailsFrame, noticeFrame } from "./theme-factory.ts";

export default defineConfig({
  themes: [detailsFrame("Project notes"), noticeFrame("Read first")],
});
```

These frames demonstrate string boundaries only. They do not claim to be a
site theme or a component library. Copy the pattern into a project and choose
the Markdown or HTML framing that its renderer supports.

## Test a factory

The direct API is convenient for a focused test:

```ts
import { renderMarkdown } from "mdtheme";
import { noticeFrame } from "./theme-factory.ts";

const result = await renderMarkdown("# Heading\n", [noticeFrame("Example")]);
```

Keep factories deterministic. Do not fetch data, read the clock, or mutate
global state while producing a frame; deterministic factories make `--check`
useful in CI.
