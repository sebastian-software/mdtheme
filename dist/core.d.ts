/** A pair of Markdown fragments wrapped around the source document. */
export type MarkdownFrame = {
    opening: string;
    closing: string;
};
/** Configuration accepted by {@link defineConfig}. */
export type Config = {
    source?: string;
    output?: string;
    themes: readonly MarkdownFrame[];
};
type RenderOptions = {
    sourceName?: string;
};
/** Validate a config and return a detached normalized value. */
export declare function defineConfig(config: Config): Config;
/**
 * Wrap Markdown source in the configured frames without reformatting its text.
 * Frames are supplied outer-first; their closing fragments are emitted
 * inner-first so each frame is properly nested.
 */
export declare function renderMarkdown(source: string, themes: readonly MarkdownFrame[], options?: RenderOptions): Promise<string>;
export {};
//# sourceMappingURL=core.d.ts.map