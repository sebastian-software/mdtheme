import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { verifyPrePush } from "./verify-pre-push.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();
const offline = process.env.MDTHEME_VERIFY_OFFLINE === "1";
const suppliedNpmCache = process.env.MDTHEME_VERIFY_NPM_CACHE;

async function run(command, args, options) {
  const { cwd, expectedCodes = [0] } = options;
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: {
        ...process.env,
        ...(npmCache ? { npm_config_cache: npmCache } : {}),
      },
      maxBuffer: 1024 * 1024 * 8,
    });
    return { ...result, code: 0 };
  } catch (error) {
    if (typeof error.code !== "number") {
      throw new TypeError(
        `${command} ${args.join(" ")} failed: ${error.message ?? String(error)}`,
        {
          cause: error,
        },
      );
    }
    const code = error.code;
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    if (!expectedCodes.includes(code)) {
      throw new Error(`${command} ${args.join(" ")} exited with ${code}\n${stdout}${stderr}`, {
        cause: error,
      });
    }
    return { stdout, stderr, code };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function packFilename(stdout) {
  const starts = [];
  for (let index = stdout.indexOf("["); index !== -1; index = stdout.indexOf("[", index + 1)) {
    starts.push(index);
  }
  for (const start of starts.toReversed()) {
    try {
      const value = JSON.parse(stdout.slice(start));
      if (Array.isArray(value) && typeof value[0]?.filename === "string") return value[0].filename;
    } catch {
      // npm lifecycle output can precede its final JSON result.
    }
  }
  throw new Error(`npm pack did not return a tarball filename:\n${stdout}`);
}

const scratchRoot = await mkdtemp(join(tmpdir(), "mdtheme-verify-"));
const packRoot = await mkdtemp(join(tmpdir(), "mdtheme-pack-"));
const npmCache = suppliedNpmCache ?? (offline ? undefined : join(scratchRoot, ".npm-cache"));

try {
  const packed = await run("npm", ["pack", "--json", "--pack-destination", packRoot], {
    cwd: packageRoot,
  });
  const tarball = join(packRoot, packFilename(packed.stdout));

  await run("npm", ["init", "--yes"], { cwd: scratchRoot });
  await writeFile(
    join(scratchRoot, "package.json"),
    JSON.stringify(
      {
        engines: { node: ">=24" },
        name: "mdtheme-badge-consumer",
        license: "MIT",
        packageManager: "pnpm@11.25.0",
        repository: "https://github.com/example/mdtheme-badge-consumer",
        type: "module",
        version: "1.2.3",
      },
      null,
      2,
    ),
  );
  const installArgs = ["install", "--ignore-scripts"];
  if (offline) installArgs.push("--offline");
  installArgs.push(tarball);
  await run("npm", installArgs, { cwd: scratchRoot });

  await writeFile(
    join(scratchRoot, "theme-factory.ts"),
    `import type { MarkdownFrame } from "mdtheme";\n\nexport function noticeFrame(label: string): MarkdownFrame {\n  return {\n    opening: \`> **\${label}**\\n>\\n\`,\n    closing: "\\n",\n  };\n}\n`,
  );
  await writeFile(
    join(scratchRoot, "mdtheme.config.ts"),
    `import { defineConfig } from "mdtheme";\nimport { noticeFrame } from "./theme-factory.ts";\n\nexport default defineConfig({\n  source: "README.md.src",\n  output: "README.md",\n  themes: [noticeFrame("Local consumer")],\n});\n`,
  );
  await writeFile(
    join(scratchRoot, "README.md.src"),
    "# Packed consumer\r\n\r\n*   Authored spacing  \r\n    and a hard line break.\r\n",
  );
  await writeFile(
    join(scratchRoot, "consumer-types.ts"),
    `import { defineConfig, projectBadges, renderMarkdown } from "mdtheme";\nimport type { Config, MarkdownFrame } from "mdtheme";\n\nconst frame: MarkdownFrame = { opening: "<section>\\n", closing: "\\n</section>\\n" };\nconst badges = projectBadges(import.meta.url, { published: false, packages: ["package.json"], workflow: "ci.yml" });\nconst config: Config = defineConfig({ themes: [frame, badges] });\nvoid config;\nvoid renderMarkdown("# Types\\n", [frame, badges]);\n`,
  );
  await writeFile(
    join(scratchRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2024",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
        },
        files: ["consumer-types.ts"],
      },
      null,
      2,
    ),
  );

  const tsc = resolve(packageRoot, "node_modules/.bin/tsc");
  await run(tsc, ["--project", join(scratchRoot, "tsconfig.json")], { cwd: scratchRoot });

  await writeFile(
    join(scratchRoot, "Cargo.toml"),
    '[package]\nname = "packed-crate"\nversion = "1.0.0"\nlicense = "MIT OR Apache-2.0"\n',
  );
  await mkdir(join(scratchRoot, "src"));
  await writeFile(join(scratchRoot, "src/lib.rs"), "pub fn example() {}\n");
  const apiCheck = join(scratchRoot, "api-check.mjs");
  await writeFile(
    apiCheck,
    `import { defineConfig, projectBadges, renderMarkdown } from "mdtheme";\n\nconst config = defineConfig({ themes: [{ opening: "<section>\\n", closing: "\\n</section>\\n" }, projectBadges(import.meta.url, { published: false })] });\nconst output = await renderMarkdown("# API\\n", config.themes);\nif (typeof output !== "string" || !output.includes("# API")) process.exit(1);\nconst badges = projectBadges(import.meta.url).opening;\nfor (const expected of ["/npm/dm/mdtheme-badge-consumer", "/crates/dr/packed-crate", "/docsrs/packed-crate", "License", "MIT%20OR%20Apache--2.0"]) { if (!badges.includes(expected)) throw new Error("Missing badge: " + expected); }\n`,
  );
  await run(process.execPath, [apiCheck], { cwd: scratchRoot });

  const badgeRoot = join(scratchRoot, "badge-project");
  const outsideCwd = join(scratchRoot, "outside");
  await mkdir(join(badgeRoot, ".github/workflows"), { recursive: true });
  await mkdir(outsideCwd);
  await writeFile(
    join(badgeRoot, "package.json"),
    JSON.stringify(
      {
        engines: { node: ">=24" },
        name: "badge-fixture",
        packageManager: "pnpm@11.25.0",
        repository: "https://github.com/example/badge-fixture",
        version: "2.3.4",
      },
      null,
      2,
    ),
  );
  await writeFile(join(badgeRoot, ".github/workflows/ci.yml"), "name: CI\n");
  await writeFile(
    join(badgeRoot, "README.md.src"),
    "# Badge fixture\n\nThis source remains ordinary Markdown.\n",
  );
  await writeFile(
    join(badgeRoot, "theme-factory.ts"),
    `import type { MarkdownFrame } from "mdtheme";\n\nexport function headerFrame(): MarkdownFrame {\n  return { opening: "<!-- header -->\\n", closing: "\\n<!-- header end -->\\n" };\n}\n`,
  );
  const badgeConfig = join(badgeRoot, "mdtheme.config.ts");
  await writeFile(
    badgeConfig,
    `import { defineConfig, projectBadges } from "mdtheme";\nimport { headerFrame } from "./theme-factory.ts";\n\nexport default defineConfig({\n  source: "README.md.src",\n  output: "README.md",\n  themes: [headerFrame(), projectBadges(import.meta.url, { published: false, workflow: "ci.yml" })],\n});\n`,
  );

  const cli = join(scratchRoot, "node_modules/.bin/mdtheme");
  const source = join(scratchRoot, "README.md.src");
  const output = join(scratchRoot, "README.md");
  const sourceBefore = await readFile(source);
  await run(cli, ["--write"], { cwd: scratchRoot });
  const generated = await readFile(output, "utf8");
  assert(
    generated.includes("This file is generated by mdtheme"),
    "CLI output is missing the generated notice",
  );
  assert(
    generated.includes("Local consumer"),
    "CLI did not load the local TypeScript theme factory",
  );
  assert(generated.includes("# Packed consumer"), "CLI output does not contain source Markdown");
  assert(
    generated.includes(sourceBefore.toString("utf8")),
    "CLI output reformatted the authored source",
  );
  await run(cli, ["--check"], { cwd: scratchRoot });

  const packagedExampleConfig = join(
    scratchRoot,
    "node_modules/mdtheme/examples/neutral/mdtheme.config.ts",
  );
  await run(cli, ["--check", "--config", packagedExampleConfig], { cwd: scratchRoot });

  const badgeOutput = join(badgeRoot, "README.md");
  const badgeSource = join(badgeRoot, "README.md.src");
  const badgeSourceBefore = await readFile(badgeSource);
  await run(cli, ["--write", "--config", badgeConfig], { cwd: outsideCwd });
  const badgeGenerated = await readFile(badgeOutput, "utf8");
  assert(badgeGenerated.includes("shields.io"), "projectBadges did not render dynamic badge URLs");
  assert(
    badgeGenerated.includes("github/actions/workflow/status/example/badge-fixture/ci.yml"),
    "projectBadges did not render the CI badge",
  );
  assert(badgeGenerated.includes("Node.js"), "projectBadges did not retain runtime badges");
  assert(
    badgeGenerated.includes("# Badge fixture"),
    "projectBadges output does not contain source Markdown",
  );
  assert(
    !badgeGenerated.includes("npmjs.com"),
    "published:false did not suppress npm registry badges",
  );
  assert(
    !badgeGenerated.includes("crates.io"),
    "published:false did not suppress crates.io registry badges",
  );
  assert(
    badgeGenerated.indexOf("<!-- header -->") < badgeGenerated.indexOf("shields.io"),
    "projectBadges did not follow the header frame",
  );
  await run(cli, ["--check", "--config", badgeConfig], { cwd: outsideCwd });

  const badgeBeforeCheck = await readFile(badgeOutput);
  const badgeDrifted = Buffer.concat([
    badgeBeforeCheck,
    Buffer.from("\nDrift introduced by verifier.\n"),
  ]);
  await writeFile(badgeOutput, badgeDrifted);
  const badgeDriftStat = await stat(badgeOutput);
  const badgeCheck = await run(cli, ["--check", "--config", badgeConfig], {
    cwd: outsideCwd,
    expectedCodes: [1],
  });
  assert(badgeCheck.code === 1, "projectBadges check did not report drift with exit status 1");
  const badgeAfterCheck = await readFile(badgeOutput);
  const badgeAfterCheckStat = await stat(badgeOutput);
  assert(
    Buffer.compare(badgeAfterCheck, badgeDrifted) === 0,
    "projectBadges check unexpectedly rewrote output",
  );
  assert(
    badgeAfterCheckStat.mtimeMs === badgeDriftStat.mtimeMs,
    "projectBadges check changed output metadata",
  );
  await run(cli, ["--write", "--config", badgeConfig], { cwd: outsideCwd });
  await run(cli, ["--check", "--config", badgeConfig], { cwd: outsideCwd });
  const badgeSourceAfter = await readFile(badgeSource);
  assert(
    Buffer.compare(badgeSourceAfter, badgeSourceBefore) === 0,
    "projectBadges write mutated the source file",
  );

  const beforeCheck = await readFile(output);
  const drifted = Buffer.concat([beforeCheck, Buffer.from("\nDrift introduced by verifier.\n")]);
  await writeFile(output, drifted);
  const driftStat = await stat(output);
  const check = await run(cli, ["--check"], { cwd: scratchRoot, expectedCodes: [1] });
  assert(check.code === 1, "CLI check did not report drift with exit status 1");
  const afterCheck = await readFile(output);
  const afterCheckStat = await stat(output);
  assert(Buffer.compare(afterCheck, drifted) === 0, "CLI check unexpectedly rewrote output");
  assert(afterCheckStat.mtimeMs === driftStat.mtimeMs, "CLI check changed output metadata");

  await run(cli, ["--write"], { cwd: scratchRoot });
  await run(cli, ["--check"], { cwd: scratchRoot });
  const sourceAfter = await readFile(source);
  assert(Buffer.compare(sourceAfter, sourceBefore) === 0, "CLI write mutated the source file");
  await verifyPrePush(scratchRoot, join(packRoot, "remote.git"), run);
  console.log("mdtheme package consumer verification passed");
} finally {
  await Promise.all([
    rm(scratchRoot, { recursive: true, force: true }),
    rm(packRoot, { recursive: true, force: true }),
  ]);
}
