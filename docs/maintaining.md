# Maintaining mdtheme

Use Node.js 24 or newer and the pinned pnpm version in `package.json`.
CI runs the complete checks on Node.js 24 and 26; releases use Node.js 24.

`tsc` uses TypeScript 7. The `typescript` dependency is a compatibility alias
for tooling that still imports the TypeScript 6 API. See the
[compiler decision](adr/0006-use-typescript-7-with-tooling-compatibility.md)
before removing either dependency.

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

## Project decisions

Read the [architecture decisions](adr/README.md) before changing a project
contract. ADRs are living documents: update the current record and its date
when an agreed decision changes. Keep exact dependency versions in
`package.json` and the lockfile.

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

## Automated releases

The workflow follows the Node product template from `sebastian-software/standards`
v0.10.0. Conventional commits produce one Release Please PR, one changelog,
and a tag such as `mdtheme-v0.1.1`. Merging that release PR creates the GitHub
Release and publishes its exact tag to npm using the shared `publish-npm` action.
Stable versions use `latest`; prerelease versions use their prerelease identifier.
The workflow runs the complete package gate before publishing.

The manifest starts at the manually published `0.1.0`. `bootstrap-sha` marks the
commit recording that baseline; remove it after the first Release Please PR has
been merged. No automatic publish of `0.1.0` is attempted.

Configure npm Trusted Publishing for the package `mdtheme` with:

- Provider: GitHub Actions
- Organization: `sebastian-software`
- Repository: `mdtheme`
- Workflow filename: `publish.yml`
- Environment: leave empty
- Allowed action: direct `npm publish`, if npm shows that option

No npm token secret is used. The publish job requests `id-token: write` and
publishes with provenance. If a publish fails after a release is created, retry
`publish.yml` through its manual trigger with that existing release tag. Branch
names and arbitrary commits are rejected. A version already published to npm
cannot be published again.

Release Please uses `RELEASE_PLEASE_TOKEN` when available, otherwise the built-in
`GITHUB_TOKEN`. The built-in token can create release PRs but does not trigger
new CI runs on them. Use a suitable GitHub App token or PAT in
`RELEASE_PLEASE_TOKEN` when automatic release-PR CI is required. The publishing
job still runs the full verification gate against the release tag.
