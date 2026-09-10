import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { projectBadges } from "../dist/badges.js";

async function fixture({
  secondPackage = false,
  secondRuntime = ">=22",
  unusual = false,
  rustRuntime = "1.80-beta",
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "mdtheme-badges-"));
  await mkdir(join(root, ".github", "workflows"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: unusual ? "@scope/tool]" : "@scope/tool-bar",
        version: "1.0.0",
        license: "MIT",
        engines: { node: ">=20 <22" },
        repository: { type: "git", url: "https://github.com/acme/project).git" },
        ...(secondPackage ? { workspaces: ["packages/*"] } : {}),
      },
      undefined,
      2,
    ),
  );
  await writeFile(
    join(root, "Cargo.toml"),
    `[package]\nname = "crate-tool"\nversion = "1.0.0"\nrust-version = "${rustRuntime}"\nlicense = "MIT OR Apache-2.0"\n`,
  );
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "lib.rs"), "pub fn example() {}\n");
  await writeFile(join(root, ".github", "workflows", "ci.yml"), "name: CI\n");
  if (secondPackage) {
    await mkdir(join(root, "packages", "other"), { recursive: true });
    await writeFile(
      join(root, "packages", "other", "package.json"),
      JSON.stringify({ name: "other-tool", version: "1.0.0", engines: { node: secondRuntime } }),
    );
  }
  return root;
}

test("discovers the standard badges in the documented order", async () => {
  const root = await fixture();
  try {
    const frame = projectBadges(root);
    assert.equal(frame.closing, "");
    assert.match(
      frame.opening,
      /https:\/\/img\.shields\.io\/npm\/v\/%40scope%2Ftool-bar\.svg\?style=flat&label=npm%3A%20%40scope%2Ftool-bar/,
    );
    assert.match(frame.opening, /https:\/\/www\.npmjs\.com\/package\/%40scope%2Ftool-bar/);
    assert.match(
      frame.opening,
      /https:\/\/img\.shields\.io\/crates\/v\/crate-tool\.svg\?style=flat&label=crates\.io%3A%20crate-tool/,
    );
    assert.match(frame.opening, /https:\/\/crates\.io\/crates\/crate-tool/);
    assert.match(
      frame.opening,
      /https:\/\/img\.shields\.io\/github\/actions\/workflow\/status\/acme\/project%29\/ci\.yml\?style=flat/,
    );
    assert.match(
      frame.opening,
      /https:\/\/github\.com\/acme\/project%29\/actions\/workflows\/ci\.yml/,
    );
    assert.match(
      frame.opening,
      /https:\/\/img\.shields\.io\/badge\/Node\.js-%3E%3D20%20%3C22-005164\.svg\?style=flat/,
    );
    assert.match(
      frame.opening,
      /https:\/\/img\.shields\.io\/badge\/Rust%20MSRV-1\.80--beta-005164\.svg\?style=flat/,
    );

    const npm = frame.opening.indexOf("/npm/v/");
    const crates = frame.opening.indexOf("/crates/v/");
    const npmDownloads = frame.opening.indexOf("/npm/dm/%40scope%2Ftool-bar.svg");
    const crateDownloads = frame.opening.indexOf("/crates/dr/crate-tool.svg");
    const docs = frame.opening.indexOf("/docsrs/crate-tool?");
    const ci = frame.opening.indexOf("/github/actions/workflow/status/");
    const runtime = frame.opening.indexOf("/badge/");
    assert.ok(npm < npmDownloads && npmDownloads < crates);
    assert.ok(crates < crateDownloads && crateDownloads < docs && docs < ci && ci < runtime);
    assert.match(frame.opening, /\]\(https:\/\/docs\.rs\/crate-tool\)/);
    assert.match(frame.opening, /License.*MIT.*\]\(package\.json\)/);
    assert.match(frame.opening, /MIT%20OR%20Apache--2\.0/);
    assert.match(frame.opening, /\]\(Cargo\.toml\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("can hide published badges while retaining CI, runtimes, and licenses", async () => {
  const root = await fixture();
  try {
    const frame = projectBadges(pathToFileURL(join(root, "mdtheme.config.mjs")), {
      published: false,
    });
    assert.equal(frame.opening.includes("/npm/v/"), false);
    assert.equal(frame.opening.includes("/crates/v/"), false);
    assert.doesNotMatch(frame.opening, /npm\/dm|crates\/dr|docs\.rs|docsrs/);
    assert.match(frame.opening, /License/);
    assert.match(frame.opening, /github\/actions\/workflow\/status/);
    assert.match(frame.opening, /badge\/Node\.js-/);
    assert.match(frame.opening, /badge\/Rust%20MSRV-/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allows an explicit workflow override", async () => {
  const root = await fixture();
  try {
    const frame = projectBadges(root, { workflow: "release.yml" });
    assert.match(frame.opening, /workflow\/status\/acme\/project%29\/release\.yml/);
    assert.match(frame.opening, /actions\/workflows\/release\.yml/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("labels runtime requirements by package when they differ", async () => {
  const root = await fixture({ secondPackage: true });
  try {
    const frame = projectBadges(root, {
      packages: ["package.json", "packages/other/package.json"],
    });
    assert.match(frame.opening, /Node\.js-%3E%3D20%20%3C22%20%28%40scope%2Ftool--bar%29/);
    assert.match(frame.opening, /Node\.js-%3E%3D22%20%28other--tool%29/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deduplicates equal runtimes per ecosystem and escapes static underscores", async () => {
  const root = await fixture({
    secondPackage: true,
    secondRuntime: ">=20 <22",
    rustRuntime: "1.80_beta",
  });
  try {
    const frame = projectBadges(root, {
      packages: ["package.json", "packages/other/package.json", "Cargo.toml"],
      published: false,
    });
    assert.equal(frame.opening.match(/badge\/Node\.js-/gu)?.length, 1);
    assert.equal(frame.opening.match(/badge\/Rust%20MSRV-/gu)?.length, 1);
    assert.match(frame.opening, /Node\.js-%3E%3D20%20%3C22-005164/);
    assert.match(frame.opening, /Rust%20MSRV-1\.80__beta-005164/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("escapes package names in Markdown labels and URLs", async () => {
  const root = await fixture({ unusual: true });
  try {
    const frame = projectBadges(root, { published: true });
    assert.match(frame.opening, /npm @scope\/tool\\\]/);
    assert.match(frame.opening, /%40scope%2Ftool%5D/);
    assert.equal(frame.opening.includes("](%40scope"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("renders local license links with escaped paths and package labels", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, "packages", "other (tool)"), { recursive: true });
    await writeFile(
      join(root, "packages", "other (tool)", "package.json"),
      JSON.stringify({ name: "other]tool", license: "BSD-2-Clause" }),
    );
    const frame = projectBadges(root, {
      packages: ["package.json", "packages/other (tool)/package.json"],
      published: false,
    });
    assert.match(frame.opening, /License.*@scope\/tool-bar.*MIT/);
    assert.match(frame.opening, /other\\\]tool/);
    assert.match(frame.opening, /BSD--2--Clause/);
    assert.ok(frame.opening.includes("](packages/other%20%28tool%29/package.json)"));
    assert.doesNotMatch(frame.opening, /codecov|coverage|github\/v\/release|bundlephobia/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
