# Standards README ownership bridge

The pinned `@sebastian-software/standards@0.10.0` release predates the explicit
`readme.owner` support. This repository applies a narrow pnpm patch to that
exact version so its generated README has one owner today.

The source change is [standards PR #81](https://github.com/sebastian-software/standards/pull/81),
commit `30d7215`. The patch contains only its compiled `apply.js`, `check.js`,
`init.js`, `repo.js`, and new `readme.js`; it does not change reference files,
managed marker contents, the manifest version, or legacy repository behavior.
The full upstream gate passed, including 219 tests.

`pnpm install --frozen-lockfile` applies the tracked patch and verifies the
lockfile hash. Both `standards check` and `readme:check` run in this repository's
CI. The theme repository additionally verifies actual apply/check/write
interoperability in a scratch consumer.

When a standards release includes PR #81, update the exact dependency pin,
remove its `patchedDependencies` entry and the corresponding patch file, refresh
the lockfile, and run the full repository gate. Keep the `readme.owner` opt-in
and README check scripts. Do not remove the bridge while pinned to 0.10.0.

The local `mdtheme` rename also updates the patch's config filenames, CLI commands,
and generated-file notice. The `markdown-themer` ownership identifier remains
unchanged for compatibility. These rename adjustments are not part of the
original upstream patch.
