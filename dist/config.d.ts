import type { Config, MarkdownFrame } from "./core.js";
export declare const CONFIG_FILENAMES: readonly ["markdown-themer.config.ts", "markdown-themer.config.mts", "markdown-themer.config.js", "markdown-themer.config.mjs"];
export type ResolvedConfig = {
    readonly source: string;
    readonly output: string;
    readonly themes: readonly MarkdownFrame[];
    readonly configPath: string | undefined;
    readonly configDir: string;
};
export declare function resolveConfig(config: Config, configDir: string, configPath?: string): ResolvedConfig;
export declare function discoverConfig(cwd?: string): string | undefined;
export declare function loadConfig(explicitPath?: string, cwd?: string): Promise<ResolvedConfig>;
//# sourceMappingURL=config.d.ts.map