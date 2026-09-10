import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { discoverProject } from "../dist/project-metadata.js";

async function fixture() {
  return mkdtemp(join(tmpdir(), "mdtheme-metadata-"));
}

async function put(root, path, contents) {
  const target = join(root, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, contents);
}

test("prefers a public root npm package and normalizes its GitHub repository", async () => {
  const root = await fixture();
  try {
    await put(
      root,
      "package.json",
      JSON.stringify({
        name: "root-tool",
        repository: { type: "git", url: "git+https://github.com/acme/root-tool.git" },
        workspaces: ["packages/*"],
      }),
    );
    await put(root, "packages/child/package.json", JSON.stringify({ name: "child-tool" }));
    await put(root, ".github/workflows/ci.yaml", "name: CI\n");
    await put(root, ".github/workflows/release.yml", "name: Release\n");

    assert.deepEqual(discoverProject(root), {
      packages: [{ registry: "npm", name: "root-tool" }],
      repository: "acme/root-tool",
      workflow: "ci.yaml",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discovers pnpm workspace packages and filters private, platform, and optional targets", async () => {
  const root = await fixture();
  try {
    await put(root, "pnpm-workspace.yaml", "packages:\n  - packages/**\n");
    await put(
      root,
      "package.json",
      JSON.stringify({ private: true, optionalDependencies: { "native-tool": "1.0.0" } }),
    );
    await put(
      root,
      "packages/public/package.json",
      JSON.stringify({ name: "public-tool", engines: { node: ">=24" } }),
    );
    await put(
      root,
      "packages/private/package.json",
      JSON.stringify({ name: "private-tool", private: true }),
    );
    await put(
      root,
      "packages/platform/package.json",
      JSON.stringify({ name: "platform-tool", os: ["darwin"] }),
    );
    await put(root, "packages/native/package.json", JSON.stringify({ name: "native-tool" }));
    await put(
      root,
      "packages/node_modules/hidden/package.json",
      JSON.stringify({ name: "hidden-tool" }),
    );

    assert.deepEqual(discoverProject(root), {
      packages: [{ registry: "npm", name: "public-tool", runtime: ">=24" }],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uses Cargo default-members and workspace rust-version inheritance", async () => {
  const root = await fixture();
  try {
    await put(
      root,
      "Cargo.toml",
      [
        "[workspace]",
        'members = ["crates/*"]',
        'default-members = ["crates/app"]',
        'exclude = ["crates/excluded"]',
        "",
        "[workspace.package]",
        'rust-version = "1.80"',
        'repository = "https://github.com/acme/rust-tools.git"',
        "",
      ].join("\n"),
    );
    await put(
      root,
      "crates/app/Cargo.toml",
      '[package]\nname = "app"\nrust-version.workspace = true\n',
    );
    await put(root, "crates/other/Cargo.toml", '[package]\nname = "other"\n');
    await put(root, "crates/excluded/Cargo.toml", '[package]\nname = "excluded"\n');

    assert.deepEqual(discoverProject(root), {
      packages: [{ registry: "crates", name: "app", runtime: "1.80" }],
      repository: "acme/rust-tools",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit manifest paths retain order while filtering unpublished packages", async () => {
  const root = await fixture();
  try {
    await put(
      root,
      "npm/package.json",
      JSON.stringify({ name: "npm-tool", optionalDependencies: { "optional-plugin": "1.0.0" } }),
    );
    await put(root, "plugin/package.json", JSON.stringify({ name: "optional-plugin" }));
    await put(root, "Cargo.toml", '[workspace]\n[workspace.package]\nrust-version = "1.80"\n');
    await put(
      root,
      "private/package.json",
      JSON.stringify({ name: "private-tool", private: true }),
    );
    await put(
      root,
      "crate/Cargo.toml",
      '[package]\nname = "crate-tool"\npublish = true\nrust-version.workspace = true\n',
    );
    await put(
      root,
      "platform/package.json",
      JSON.stringify({ name: "platform-tool", cpu: ["x64"] }),
    );

    assert.deepEqual(
      discoverProject(pathToFileURL(join(root, "config.mjs")), [
        "crate/Cargo.toml",
        "npm/package.json",
        "plugin/package.json",
        "private/package.json",
        "platform/package.json",
      ]),
      {
        packages: [
          { registry: "crates", name: "crate-tool", runtime: "1.80" },
          { registry: "npm", name: "npm-tool" },
          { registry: "npm", name: "optional-plugin" },
        ],
      },
    );
    assert.throws(() => discoverProject(root, ["missing/package.json"]), /does not exist/);
    assert.throws(() => discoverProject(root, ["README.md"]), /does not exist/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uses a single nonstandard workflow and reports malformed manifests clearly", async () => {
  const root = await fixture();
  try {
    await put(root, ".github/workflows/build.yml", "name: Build\n");
    assert.equal(discoverProject(root).workflow, "build.yml");
    await put(root, ".github/workflows/test.yml", "name: Test\n");
    assert.equal(discoverProject(root).workflow, undefined);
    await put(root, "package.json", "{broken\n");
    assert.throws(() => discoverProject(root), /Unable to read .*package\.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("filters Cargo publication restrictions including workspace inheritance", async () => {
  const root = await fixture();
  try {
    await put(
      root,
      "Cargo.toml",
      '[workspace]\nmembers = ["crates/*"]\n[workspace.package]\npublish = false\n',
    );
    const declarations = {
      internal: "false",
      inherited: "{ workspace = true }",
      disabled: "[]",
      custom: '["company"]',
      public: '["crates-io"]',
    };
    for (const [name, publish] of Object.entries(declarations)) {
      await put(
        root,
        `crates/${name}/Cargo.toml`,
        `[package]\nname = "${name}"\npublish = ${publish}\n`,
      );
    }
    assert.deepEqual(discoverProject(root).packages, [{ registry: "crates", name: "public" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
