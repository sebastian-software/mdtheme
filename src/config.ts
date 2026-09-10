import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import type { Config, MarkdownFrame } from "./core.js";

import { defineConfig } from "./core.js";

export const CONFIG_FILENAMES = [
  "mdtheme.config.ts",
  "mdtheme.config.mts",
  "mdtheme.config.js",
  "mdtheme.config.mjs",
] as const;

export type ResolvedConfig = {
  readonly source: string;
  readonly output: string;
  readonly themes: readonly MarkdownFrame[];
  readonly configPath: string | undefined;
  readonly configDir: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolvePath(value: string, configDir: string): string {
  return resolve(configDir, value);
}

export function resolveConfig(
  config: Config,
  configDir: string,
  configPath?: string,
): ResolvedConfig {
  const checked = defineConfig(config);
  const source = resolvePath(checked.source ?? "README.md.src", configDir);
  const output = resolvePath(checked.output ?? "README.md", configDir);
  if (basename(output) !== "README.md") {
    throw new TypeError("Invalid mdtheme config: output must be the root README.md file");
  }
  if (dirname(source) !== configDir || dirname(output) !== configDir) {
    throw new TypeError(
      "Invalid mdtheme config: source and output must be files in the config directory",
    );
  }
  return {
    source,
    output,
    themes: checked.themes,
    configPath,
    configDir,
  };
}

export function discoverConfig(cwd = process.cwd()): string | undefined {
  // This synchronous discovery keeps config selection deterministic before any I/O that
  // could modify the output. The actual config module is loaded asynchronously below.
  const found = CONFIG_FILENAMES.filter((name) => existsSync(resolve(cwd, name)));
  if (found.length > 1) {
    throw new Error(`Multiple mdtheme config files found: ${found.join(", ")}`);
  }
  const first = found[0];
  return found.length === 1 && first !== undefined ? resolve(cwd, first) : undefined;
}

async function canonicalPath(selected: string): Promise<string> {
  const fs = await import("node:fs/promises");
  try {
    return await fs.realpath(selected);
  } catch (error) {
    throw new Error(
      `Cannot read config ${selected}: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
}

async function importConfig(configPath: string): Promise<unknown> {
  try {
    const jiti = createJiti(configPath, {
      interopDefault: true,
      moduleCache: false,
      fsCache: false,
    });
    return await jiti.import(configPath);
  } catch (error) {
    throw new Error(
      `Cannot load config ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
}

export async function loadConfig(
  explicitPath?: string,
  cwd = process.cwd(),
): Promise<ResolvedConfig> {
  const selected = explicitPath === undefined ? discoverConfig(cwd) : resolve(cwd, explicitPath);
  if (selected === undefined) {
    return resolveConfig({ themes: [] }, cwd);
  }
  const configPath = await canonicalPath(selected);
  const imported = await importConfig(configPath);
  const config = isRecord(imported) && "default" in imported ? imported.default : imported;
  // defineConfig is the runtime validation boundary for the jiti-loaded module.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return resolveConfig(config as Config, dirname(configPath), configPath);
}
