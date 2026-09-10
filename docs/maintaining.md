# Maintaining Markdown Themer

Use Node 24 or newer and the pinned pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm agent:check
```

The gate checks lint, formatting, types, build, Node tests, the npm tarball in a
clean consumer, and standards consistency. `dist/` is built for packing and is
committed so an immutable Git dependency can be consumed without a `prepare`
lifecycle step. Run the packed consumer after public API, CLI or export changes.

The first release is prepared as version 0.1.0. Creating this repository does
not publish an npm package. An authorized maintainer can publish the verified
tarball through the organization's normal npm credentials and release process.
Never put npm tokens in the repository.

## Immutable Git dependencies

Until npm publication, consumers should pin this repository and any companion
theme repository to immutable commits:

```json
{
  "devDependencies": {
    "markdown-themer": "git+https://github.com/sebastian-software/markdown-themer.git#<markdown-themer-commit>",
    "sebastian-theme": "git+https://github.com/sebastian-software/sebastian-theme.git#<sebastian-theme-commit>"
  }
}
```

Pin reviewed commits rather than moving branches. Both repositories commit `dist/` and omit a
`prepare` script, so installing a pinned Git dependency does not require the
consumer to build the package.

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
delegates README branding to markdown-themer through this metadata:

```json
{
  "readme": { "owner": "markdown-themer" }
}
```

The metadata keeps standards from rewriting the generated README's framing. The
current stable standards CLI does not yet support this ownership field, so a
local narrow pnpm patch bridges the forthcoming upstream support; remove that
patch when the supporting release is available. See the
[patch provenance and removal steps](standards-integration.md). Generated README examples
demonstrate this tool; website composition and React components remain separate
work.
