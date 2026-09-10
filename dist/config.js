import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { defineConfig } from "./core.js";
export const CONFIG_FILENAMES = [
    "markdown-themer.config.ts",
    "markdown-themer.config.mts",
    "markdown-themer.config.js",
    "markdown-themer.config.mjs",
];
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function resolvePath(value, configDir) {
    return resolve(configDir, value);
}
export function resolveConfig(config, configDir, configPath) {
    const checked = defineConfig(config);
    const source = resolvePath(checked.source ?? "README.md.src", configDir);
    const output = resolvePath(checked.output ?? "README.md", configDir);
    if (basename(output) !== "README.md") {
        throw new TypeError("Invalid markdown-themer config: output must be the root README.md file");
    }
    if (dirname(source) !== configDir || dirname(output) !== configDir) {
        throw new TypeError("Invalid markdown-themer config: source and output must be files in the config directory");
    }
    return {
        source,
        output,
        themes: checked.themes,
        configPath,
        configDir,
    };
}
export function discoverConfig(cwd = process.cwd()) {
    // This synchronous discovery keeps config selection deterministic before any I/O that
    // could modify the output. The actual config module is loaded asynchronously below.
    const found = CONFIG_FILENAMES.filter((name) => existsSync(resolve(cwd, name)));
    if (found.length > 1) {
        throw new Error(`Multiple markdown-themer config files found: ${found.join(", ")}`);
    }
    const first = found[0];
    return found.length === 1 && first !== undefined ? resolve(cwd, first) : undefined;
}
async function canonicalPath(selected) {
    const fs = await import("node:fs/promises");
    try {
        return await fs.realpath(selected);
    }
    catch (error) {
        throw new Error(`Cannot read config ${selected}: ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
        });
    }
}
async function importConfig(configPath) {
    try {
        const jiti = createJiti(configPath, {
            interopDefault: true,
            moduleCache: false,
            fsCache: false,
        });
        return await jiti.import(configPath);
    }
    catch (error) {
        throw new Error(`Cannot load config ${configPath}: ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
        });
    }
}
export async function loadConfig(explicitPath, cwd = process.cwd()) {
    const selected = explicitPath === undefined ? discoverConfig(cwd) : resolve(cwd, explicitPath);
    if (selected === undefined) {
        return resolveConfig({ themes: [] }, cwd);
    }
    const configPath = await canonicalPath(selected);
    const imported = await importConfig(configPath);
    const config = isRecord(imported) && "default" in imported ? imported.default : imported;
    // defineConfig is the runtime validation boundary for the jiti-loaded module.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return resolveConfig(config, dirname(configPath), configPath);
}
//# sourceMappingURL=config.js.map