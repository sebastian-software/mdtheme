# Regenerate your README before pushing

Use `mdtheme pre-push` to regenerate your README during a Git push and require
a clean, committed result. It uses the same config and generation rules as
`--write`.

The command requires Node.js 24 or newer, Git on PATH, and a worktree with at
least one commit. Install mdtheme as a project dependency first:

```sh
npm install --save-dev mdtheme
```

## Add the command

Add a script to your project's `package.json`:

```json
{
  "scripts": {
    "readme:write": "mdtheme --write",
    "readme:check": "mdtheme --check",
    "readme:pre-push": "mdtheme pre-push"
  }
}
```

Run `npm run readme:pre-push` to try it manually. For a README in a subdirectory,
use `mdtheme pre-push --config docs/mdtheme.config.ts` in the script.
The config, source, and output must belong to the current Git worktree.

## Connect it to Git

If your project already uses a hook manager or a pre-push hook, add
`npm run --silent readme:pre-push` to that hook and propagate its failure.
Keep the existing checks. Do not forward Git's remote arguments to mdtheme.

For a project without existing hooks, create `.githooks/pre-push`:

```sh
#!/bin/sh
exec npm run --silent readme:pre-push
```

Make it executable and enable the hook directory for your local clone:

```sh
chmod +x .githooks/pre-push
git config --local core.hooksPath .githooks
```

Check `git config --get core.hooksPath` before changing it: selecting a new
directory replaces the hook location Git uses. Commit the hook, package files,
source, config, and generated README. Each contributor enables the hook
directory after cloning and installs dependencies. mdtheme does not install
hooks automatically.

Git runs the hook from the worktree root. The script uses the installed local
package through npm; it does not download a CLI during a push.

## What happens during a push

1. mdtheme checks the entire worktree, including staged changes, unstaged
   changes, untracked files, and dirty submodules. If anything is pending,
   it exits before loading the config or generating the README.
2. From a clean checkout, it regenerates the configured README.
3. If generation changes the README, or the checkout changes during generation,
   it blocks the push. The generated file stays on disk for review.
4. If the README is committed and current and the worktree remains clean,
   it lets Git continue.

After a blocked push, inspect `git diff` and `git status`, commit the changes
you want to keep, then push again. mdtheme never stages, commits, or pushes.
To avoid a second commit, run `npm run readme:write` before your initial commit.

The source, selected config, and output must be tracked. Other ignored files,
such as `node_modules` and build caches, do not count as pending changes.
Commit local theme factories and the metadata they read as part of your normal
project workflow. Configs remain trusted executable code.

| Status | Meaning                                                                              |
| -----: | ------------------------------------------------------------------------------------ |
|      0 | The README is current and the worktree is clean.                                     |
|      1 | The push is blocked by pending changes or an uncommitted generation input or output. |
|      2 | Git inspection, arguments, config, paths, or generation failed.                      |

Both nonzero statuses stop Git when the hook propagates them.

## Keep the CI check

Local hooks are optional and can be bypassed. Keep `mdtheme --check` in CI to
verify each checked-out commit without writing files. See [usage](usage.md)
for the check command.

The pre-push command checks the current checkout, not every branch or tag named
in a push. It does not inspect Git's list of outgoing refs. Use it for the
normal edit, commit, and push workflow; CI remains the check for other refs.
