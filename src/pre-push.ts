import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { promisify } from "node:util";

import type { CliIO } from "./cli.js";
import type { ResolvedConfig } from "./config.js";

import { loadConfig } from "./config.js";
import { writeFiles } from "./files.js";

// Node supplies custom Promise support for execFile, including stdout and stderr.
// eslint-disable-next-line @typescript-eslint/strict-void-return
const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.replace(/\r?\n$/u, "");
  } catch (error) {
    throw new Error(
      "Cannot inspect Git state. Run pre-push inside a Git worktree with an existing commit and Git on PATH.",
      { cause: error },
    );
  }
}

async function dirty(root: string): Promise<boolean> {
  const status = await git(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
  ]);
  return status.length !== 0;
}

function repositoryPath(root: string, path: string): string {
  const value = relative(root, path);
  if (isAbsolute(value) || value === ".." || value.startsWith(`..${sep}`)) {
    throw new Error(
      "The pre-push config, source, and output must belong to the current Git worktree.",
    );
  }
  return value.split(sep).join("/");
}

async function tracked(root: string, path: string): Promise<boolean> {
  const files = await git(root, [
    "--literal-pathspecs",
    "ls-files",
    "-z",
    "--",
    repositoryPath(root, path),
  ]);
  return files.length !== 0;
}

async function validateInputs(
  root: string,
  config: ResolvedConfig,
  io: Required<CliIO>,
): Promise<boolean> {
  const configRoot = await realpath(await git(config.configDir, ["rev-parse", "--show-toplevel"]));
  if (configRoot !== root)
    throw new Error("The pre-push config must belong to the current Git worktree.");
  repositoryPath(root, config.output);
  for (const input of [
    config.source,
    ...(config.configPath === undefined ? [] : [config.configPath]),
  ]) {
    if (!(await tracked(root, input))) {
      io.stderr(`Push blocked: commit ${input} before running pre-push.`);
      return false;
    }
  }

  return true;
}

async function committedResult(root: string, head: string, output: string): Promise<boolean> {
  const committed = await tracked(root, output);
  const currentHead = await git(root, ["rev-parse", "--verify", "HEAD"]);
  const changedWorktree = await dirty(root);
  return committed && head === currentHead && !changedWorktree;
}

/** Regenerate only from a clean checkout and require a committed result. */
export async function runPrePush(
  configPath: string | undefined,
  io: Required<CliIO>,
): Promise<number> {
  const root = await realpath(await git(process.cwd(), ["rev-parse", "--show-toplevel"]));
  const head = await git(root, ["rev-parse", "--verify", "HEAD"]);
  if (await dirty(root)) {
    io.stderr(
      "Push blocked: the worktree has staged, unstaged, or untracked changes. Commit or stash them, then push again. README generation was skipped.",
    );
    return 1;
  }

  const config = await loadConfig(configPath);
  if (!(await validateInputs(root, config, io))) return 1;

  const changed = await writeFiles(config);
  if (changed) io.stdout(`Updated ${config.output}.`);
  const clean = await committedResult(root, head, config.output);
  if (changed || !clean) {
    io.stderr(
      "Push blocked: review the generated README and Git changes, commit them, then push again. mdtheme did not stage or commit anything.",
    );
    return 1;
  }
  io.stdout("README is up to date and the worktree is clean. Push may continue.");
  return 0;
}
