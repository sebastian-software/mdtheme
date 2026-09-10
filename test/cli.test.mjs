import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { link, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const here = import.meta.dirname;
const candidate = resolve(here, "../dist/cli.js");
const cli = existsSync(candidate) ? candidate : resolve(here, "../dist/src/cli.js");

function invoke(cwd, ...args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code, signal) => resolveResult({ code, signal, stdout, stderr }));
  });
}

async function fixture(prefix = "mdtheme-") {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  await writeFile(join(directory, "README.md.src"), "# Hello\n\nThis is authored prose.\n");
  await writeFile(
    join(directory, "mdtheme.config.ts"),
    'export default { themes: [{ opening: "<!-- theme -->\\n", closing: "<!-- /theme -->\\n" }] };\n',
  );
  return directory;
}

test("CLI writes through a TypeScript config and check is read-only", async () => {
  const directory = await fixture();
  try {
    const written = await invoke(directory, "--write");
    assert.equal(written.code, 0, written.stderr);
    const generated = await readFile(join(directory, "README.md"), "utf8");
    assert.match(generated, /# Hello/);
    assert.match(generated, /theme/);

    const checked = await invoke(directory, "--check");
    assert.equal(checked.code, 0, checked.stderr);
    await writeFile(join(directory, "README.md"), "drift\n");
    const before = await readFile(join(directory, "README.md"), "utf8");
    const drift = await invoke(directory, "--check");
    assert.equal(drift.code, 1);
    assert.equal(await readFile(join(directory, "README.md"), "utf8"), before);
    const entries = await readdir(directory);
    assert.deepEqual(
      entries.filter((name) => name.includes(".README.md.") && name.endsWith(".tmp")),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("same files, hardlinks, relocated sources, and invalid configs fail before mutation", async () => {
  const directory = await fixture();
  try {
    await writeFile(join(directory, "README.md"), "keep me\n");
    const original = await readFile(join(directory, "README.md"), "utf8");
    await writeFile(
      join(directory, "mdtheme.config.ts"),
      'export default { source: "README.md", themes: [] };\n',
    );
    const sameFile = await invoke(directory, "--write");
    assert.equal(sameFile.code, 2);
    assert.equal(await readFile(join(directory, "README.md"), "utf8"), original);

    await writeFile(join(directory, "mdtheme.config.ts"), "export default { themes: [] };\n");
    await rm(join(directory, "README.md"));
    await link(join(directory, "README.md.src"), join(directory, "README.md"));
    const linkedOutput = await invoke(directory, "--write");
    assert.equal(linkedOutput.code, 2);
    await rm(join(directory, "README.md"));
    await writeFile(join(directory, "README.md"), original);

    await writeFile(
      join(directory, "mdtheme.config.ts"),
      'export default { source: "../README.md.src", themes: [] };\n',
    );
    const relocatedSource = await invoke(directory, "--write");
    assert.equal(relocatedSource.code, 2);
    assert.equal(await readFile(join(directory, "README.md"), "utf8"), original);

    await writeFile(
      join(directory, "mdtheme.config.ts"),
      "export default { themes: [], unknown: true };\n",
    );
    const unknownConfig = await invoke(directory, "--write");
    assert.equal(unknownConfig.code, 2);
    assert.equal(await readFile(join(directory, "README.md"), "utf8"), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("check reports absent output, discovery ambiguity, and preserves unchanged write", async () => {
  const directory = await fixture();
  try {
    const absent = await invoke(directory, "--check");
    assert.equal(absent.code, 1);
    const entries = await readdir(directory);
    assert.equal(entries.includes("README.md"), false);

    await writeFile(join(directory, "mdtheme.config.js"), "export default { themes: [] };\n");
    const ambiguous = await invoke(directory, "--check");
    assert.equal(ambiguous.code, 2);
    await rm(join(directory, "mdtheme.config.js"));

    const firstWrite = await invoke(directory, "--write");
    assert.equal(firstWrite.code, 0);
    const before = await stat(join(directory, "README.md"));
    await new Promise((resolveResult) => {
      setTimeout(resolveResult, 25);
    });
    const secondWrite = await invoke(directory, "--write");
    assert.equal(secondWrite.code, 0);
    const after = await stat(join(directory, "README.md"));
    assert.equal(after.mtimeNs, before.mtimeNs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an explicit config resolves source and output from its own directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "mdtheme-"));
  const project = await fixture();
  try {
    const result = await invoke(root, "--write", "--config", join(project, "mdtheme.config.ts"));
    assert.equal(result.code, 0, result.stderr);
    const outputStat = await stat(join(project, "README.md"));
    assert.equal(outputStat.isFile(), true);
    const rootEntries = await readdir(root);
    assert.equal(rootEntries.includes("README.md"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
});

test("explicit config hints quote paths containing spaces", async () => {
  const root = await mkdtemp(join(tmpdir(), "mdtheme-"));
  const project = await fixture("markdown themer-");
  const configPath = join(project, "mdtheme.config.ts");
  try {
    const written = await invoke(root, "--write", "--config", configPath);
    assert.equal(written.code, 0, written.stderr);
    await writeFile(join(project, "README.md"), "drift\n");

    const checked = await invoke(root, "--check", "--config", configPath);
    assert.equal(checked.code, 1);
    assert.ok(checked.stderr.includes(`Run mdtheme --write --config '${configPath}'.`));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
});

test("explicit config hints shell quote metacharacters and apostrophes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mdtheme-"));
  try {
    const configPath = join(directory, "config-$()-it's.ts");
    await writeFile(join(directory, "README.md.src"), "# Safe\n");
    await writeFile(configPath, "export default { themes: [] };\n");
    const result = await invoke(directory, "--check", "--config", configPath);
    assert.equal(result.code, 1, result.stderr);
    const quoted = `'${configPath.replaceAll("'", "'\\''")}'`;
    assert.ok(result.stderr.includes(`Run mdtheme --write --config ${quoted}.`));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("write reports missing source before touching an existing README", async () => {
  const directory = await fixture();
  try {
    await writeFile(join(directory, "README.md"), "keep me\n");
    await rm(join(directory, "README.md.src"));
    const result = await invoke(directory, "--write");
    assert.equal(result.code, 2);
    const existing = await readFile(join(directory, "README.md"), "utf8");
    assert.equal(existing, "keep me\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("output symlinks and relocated outputs are rejected", async () => {
  const directory = await fixture();
  try {
    await symlink("README.md.src", join(directory, "README.md"));
    const symlinkResult = await invoke(directory, "--write");
    assert.equal(symlinkResult.code, 2);
    await rm(join(directory, "README.md"));
    await writeFile(
      join(directory, "mdtheme.config.ts"),
      'export default { output: "other/README.md", themes: [] };\n',
    );
    const relocated = await invoke(directory, "--write");
    assert.equal(relocated.code, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("operation parsing and help/version have the documented exit contract", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mdtheme-"));
  try {
    const help = await invoke(directory, "--help");
    assert.equal(help.code, 0);
    assert.match(help.stdout, /Usage: mdtheme/);
    const version = await invoke(directory, "--version");
    assert.equal(version.code, 0);
    assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+/);
    const duplicateOperation = await invoke(directory, "--write", "--check");
    assert.equal(duplicateOperation.code, 2);
    const unknownArgument = await invoke(directory, "--nope");
    assert.equal(unknownArgument.code, 2);

    const link = join(directory, "mdtheme");
    await symlink(cli, link);
    const throughLink = await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, [link, "--version"], {
        cwd: directory,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (code) => resolveResult({ code, stdout, stderr }));
    });
    assert.equal(throughLink.code, 0, throughLink.stderr);
    assert.match(throughLink.stdout.trim(), /^\d+\.\d+\.\d+/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prototype-name arguments are rejected without mutating project files", async () => {
  const directory = await fixture();
  const outputPath = join(directory, "README.md");
  const sourcePath = join(directory, "README.md.src");
  try {
    await writeFile(outputPath, "sentinel output\n");
    const outputBefore = await readFile(outputPath);
    const sourceBefore = await readFile(sourcePath);

    for (const argument of ["constructor", "toString", "__proto__"]) {
      const result = await invoke(directory, argument);
      assert.equal(result.code, 2, `${argument}: ${result.stderr}`);
      assert.match(result.stderr, /Unknown argument/);
      assert.deepEqual(await readFile(outputPath), outputBefore);
      assert.deepEqual(await readFile(sourcePath), sourceBefore);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
