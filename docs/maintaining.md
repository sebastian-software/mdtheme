# Maintaining mdtheme

Use Node 24 or newer and the pinned pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm agent:check
```

The gate checks lint, formatting, types, build, Node tests, the npm tarball in a
clean consumer, and standards consistency. `dist/` is built for packing and is
committed so an immutable Git dependency can be consumed without a `prepare`
lifecycle step. Run the packed consumer after public API, CLI or export changes.

Version 0.1.0 was first published manually to npm as `mdtheme`. Future releases
are managed by Release Please through `.github/workflows/publish.yml`.

## Theme dependencies

The tool is distributed through npm. Companion themes can remain Git dependencies:

```json
{
  "devDependencies": {
    "mdtheme": "^0.1.0",
    "sebastian-theme": "git+https://github.com/sebastian-software/sebastian-theme.git#main"
  }
}
```

The lockfile records the resolved theme commit. Update the dependency to pick up
new branding from `main`. The theme commits its built output, so consumers do
not need to compile it.

## README dogfooding

The editable project corpus is `README.md.src`; `README.md` is generated from
it. The repository config selects `sebastian-theme/markdown` with the committed
theme revision. After changing the corpus or either pinned package, run:

```sh
pnpm readme:write
pnpm readme:check
```

Review the generated README as part of the same change. Check mode must pass in
CI and never writes the output.

This repository is onboarded to `@sebastian-software/standards`. Its own README
delegates README branding to mdtheme through this metadata:

```json
{
  "readme": { "owner": "markdown-themer" }
}
```

The `markdown-themer` owner identifier is retained for compatibility with the
existing standards integration; the package and CLI are now named `mdtheme`.

The metadata keeps standards from rewriting the generated README's framing. The
current stable standards CLI does not yet support this ownership field, so a
local narrow pnpm patch bridges the forthcoming upstream support; remove that
patch when the supporting release is available. See the
[patch provenance and removal steps](standards-integration.md). Generated README examples
demonstrate this tool; website composition and React components remain separate
work.
