import assert from "node:assert/strict";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function initialize(root, run) {
  const git = (args) => run("git", ["-C", root, ...args], { cwd: root });
  await git(["init", "--initial-branch=main"]);
  await git(["config", "user.name", "Package verifier"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "commit.gpgsign", "false"]);
  await git(["config", "core.hooksPath", ".githooks"]);
  await mkdir(join(root, ".githooks"));
  await writeFile(
    join(root, ".githooks/pre-push"),
    "#!/bin/sh\nexec npm run --silent readme:pre-push\n",
  );
  await chmod(join(root, ".githooks/pre-push"), 0o755);
  await writeFile(join(root, ".gitignore"), "node_modules/\n.npm-cache/\n");
  const path = join(root, "package.json");
  const pkg = JSON.parse(await readFile(path, "utf8"));
  pkg.scripts = { ...pkg.scripts, "readme:pre-push": "mdtheme pre-push" };
  await writeFile(path, JSON.stringify(pkg, null, 2));
}

async function commit(root, run) {
  await run("git", ["add", "."], { cwd: root });
  await run("git", ["commit", "-m", "fixture"], { cwd: root });
}

async function verifyBlockedPush(root, remote, run) {
  await writeFile(join(root, "README.md.src"), "# Updated before push\n");
  await commit(root, run);
  const before = await run("git", ["rev-parse", "HEAD"], { cwd: root });
  const blocked = await run("git", ["push", remote, "HEAD:refs/heads/main"], {
    cwd: root,
    expectedCodes: [1],
  });
  assert.equal(blocked.code, 1);
  assert.match(blocked.stdout + blocked.stderr, /Push blocked/);
  const remoteRefs = await run("git", ["ls-remote", remote], { cwd: root });
  assert.equal(remoteRefs.stdout, "");
  const index = await run("git", ["diff", "--cached", "--name-only"], { cwd: root });
  assert.equal(index.stdout, "");
  const after = await run("git", ["rev-parse", "HEAD"], { cwd: root });
  assert.equal(after.stdout, before.stdout);
}

export async function verifyPrePush(root, remote, run) {
  await initialize(root, run);
  await commit(root, run);
  await run("git", ["init", "--bare", remote], { cwd: root });
  await verifyBlockedPush(root, remote, run);
  await commit(root, run);
  await run("git", ["push", remote, "HEAD:refs/heads/main"], { cwd: root });
  const remoteHead = await run("git", ["--git-dir", remote, "rev-parse", "main"], { cwd: root });
  const localHead = await run("git", ["rev-parse", "HEAD"], { cwd: root });
  assert.equal(remoteHead.stdout, localHead.stdout);
  const status = await run("git", ["status", "--porcelain"], { cwd: root });
  assert.equal(status.stdout, "");
}
