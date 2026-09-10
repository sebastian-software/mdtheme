import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = resolve(import.meta.dirname, "../dist/cli.js");

async function git(root, ...args) {
  const result = await exec("git", ["-C", root, ...args]);
  return result.stdout.trim();
}

async function invoke(root, ...args) {
  try {
    return { ...(await exec(process.execPath, [cli, ...args], { cwd: root })), code: 0 };
  } catch (error) {
    if (typeof error.code !== "number") throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

async function expectCode(code, root, ...args) {
  const result = await invoke(root, ...args);
  assert.equal(result.code, code, result.stderr);
}

async function commit(root) {
  await git(root, "add", ".");
  await git(root, "commit", "-m", "fixture");
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "mdtheme-pre-push-"));
  await git(root, "init", "--initial-branch=main");
  await git(root, "config", "user.name", "Test");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "config", "commit.gpgsign", "false");
  await git(root, "config", "core.hooksPath", join(root, "no-hooks"));
  await writeFile(join(root, "README.md.src"), "# Initial\n");
  await expectCode(0, root, "--write");
  await commit(root);
  return root;
}

test("pre-push passes a clean committed README without touching it", async () => {
  const root = await fixture();
  try {
    const before = await stat(join(root, "README.md"));
    const head = await git(root, "rev-parse", "HEAD");
    const result = await invoke(root, "pre-push");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Push may continue/);
    const after = await stat(join(root, "README.md"));
    assert.equal(after.mtimeMs, before.mtimeMs);
    assert.equal(await git(root, "rev-parse", "HEAD"), head);
    assert.equal(await git(root, "status", "--porcelain"), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-push regenerates stale committed output, blocks, then passes after commit", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "README.md.src"), "# Updated\n");
    await commit(root);
    const head = await git(root, "rev-parse", "HEAD");
    const result = await invoke(root, "pre-push");
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /commit them, then push again/);
    assert.match(await readFile(join(root, "README.md"), "utf8"), /# Updated/);
    assert.equal(await git(root, "diff", "--cached", "--name-only"), "");
    assert.equal(await git(root, "rev-parse", "HEAD"), head);
    await commit(root);
    await expectCode(0, root, "pre-push");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-push rejects staged, unstaged, and untracked changes before loading config", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "mdtheme.config.mjs"), 'throw new Error("config executed");\n');
    await commit(root);
    const before = await readFile(join(root, "README.md"));
    for (const mode of ["unstaged", "staged", "untracked"]) {
      const path = mode === "untracked" ? "scratch.txt" : "README.md.src";
      await writeFile(join(root, path), "changed\n");
      if (mode === "staged") await git(root, "add", path);
      await git(root, "config", "status.showUntrackedFiles", "no");
      const result = await invoke(root, "pre-push");
      assert.equal(result.code, 1, result.stderr);
      assert.match(result.stderr, /generation was skipped/);
      assert.doesNotMatch(result.stderr, /config executed/);
      assert.deepEqual(await readFile(join(root, "README.md")), before);
      if (mode === "untracked") await rm(join(root, path));
      else await git(root, "restore", "--staged", "--worktree", path);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-push does not accept ignored output or ignored config as committed", async () => {
  const root = await fixture();
  try {
    await git(root, "rm", "README.md");
    await writeFile(join(root, ".gitignore"), "README.md\nignored.config.mjs\n");
    await commit(root);
    await expectCode(1, root, "pre-push");
    assert.equal(await git(root, "status", "--porcelain"), "");
    await expectCode(1, root, "pre-push");
    await writeFile(join(root, "ignored.config.mjs"), "export default { themes: [] };\n");
    const result = await invoke(root, "pre-push", "--config", "ignored.config.mjs");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /commit .*ignored.config/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-push checks the entire repository when using a nested config", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "docs/README.md.src"), "# Nested\n");
    await writeFile(join(root, "docs/config.mjs"), "export default { themes: [] };\n");
    await commit(root);
    const args = ["pre-push", "--config", "docs/config.mjs"];
    await expectCode(1, root, ...args);
    await commit(root);
    await expectCode(0, root, ...args);
    await writeFile(join(root, "unrelated.txt"), "untracked\n");
    await expectCode(1, join(root, "docs"), "pre-push", "--config", "config.mjs");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-push reports non-Git locations, foreign configs, and invalid arguments", async () => {
  const root = await fixture();
  const other = await fixture();
  const plain = await mkdtemp(join(tmpdir(), "mdtheme-no-git-"));
  try {
    await expectCode(2, plain, "pre-push");
    await writeFile(join(other, "config.mjs"), "export default { themes: [] };\n");
    await commit(other);
    const before = await readFile(join(other, "README.md"));
    await expectCode(2, root, "pre-push", "--config", join(other, "config.mjs"));
    assert.deepEqual(await readFile(join(other, "README.md")), before);
    await expectCode(2, root, "pre-push", "--write");
    await expectCode(2, root, "pre-push", "--config");
  } finally {
    await Promise.all(
      [root, other, plain].map((path) => rm(path, { recursive: true, force: true })),
    );
  }
});

test("pre-push detects changes made while loading trusted config", async () => {
  const root = await fixture();
  try {
    await writeFile(
      join(root, "config.mjs"),
      'import { writeFileSync } from "node:fs";\nwriteFileSync(new URL("side-effect.txt", import.meta.url), "changed");\nexport default { themes: [] };\n',
    );
    await commit(root);
    await expectCode(1, root, "pre-push", "--config", "config.mjs");
    assert.equal(await git(root, "diff", "--cached", "--name-only"), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-push supports a linked worktree", async () => {
  const root = await fixture();
  const parent = await mkdtemp(join(tmpdir(), "mdtheme-linked-"));
  const linked = join(parent, "checkout");
  try {
    await git(root, "worktree", "add", "-b", "linked", linked);
    await expectCode(0, linked, "pre-push");
    await writeFile(join(linked, "README.md.src"), "# Linked\n");
    await commit(linked);
    await expectCode(1, linked, "pre-push");
    assert.doesNotMatch(await readFile(join(root, "README.md"), "utf8"), /# Linked/);
  } finally {
    await git(root, "worktree", "remove", "--force", linked);
    await Promise.all([root, parent].map((path) => rm(path, { recursive: true, force: true })));
  }
});

test("pre-push rejects a HEAD change even if config leaves a clean worktree", async () => {
  const root = await fixture();
  try {
    await writeFile(
      join(root, "config.mjs"),
      'import { execFileSync } from "node:child_process";\nexecFileSync("git", ["commit", "--allow-empty", "-m", "config side effect"]);\nexport default { themes: [] };\n',
    );
    await commit(root);
    await expectCode(1, root, "pre-push", "--config", "config.mjs");
    assert.equal(await git(root, "status", "--porcelain"), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
