# Maintaining Markdown Themer

Use Node 24 or newer and the pinned pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm agent:check
```

The gate checks lint, formatting, types, build, Node tests, the npm tarball in a
clean consumer, and standards consistency. `dist/` is built for packing and is
not committed. Run the packed consumer after public API, CLI or export changes.

The first release is prepared as version 0.1.0. Creating this repository does
not publish an npm package. An authorized maintainer can publish the verified
tarball through the organization's normal npm credentials and release process.
Never put npm tokens in the repository.

This repository is onboarded to `@sebastian-software/standards`. Its own README
is initially handwritten, with the standards-owned company footer. Generated
README examples demonstrate this tool; switching an existing standards-owned
README to full generation requires an explicit ownership migration. That
upstream standards integration and actual company/family theme packages are
separate work, not dependencies hidden in this CLI.
