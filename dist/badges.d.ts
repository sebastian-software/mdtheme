import type { MarkdownFrame } from "./core.js";
export type ProjectBadgesOptions = {
    packages?: readonly string[];
    published?: boolean;
    workflow?: string;
};
/** Return a deterministic Markdown badge row for the discovered project. */
export declare function projectBadges(root: string | URL, options?: ProjectBadgesOptions): MarkdownFrame;
//# sourceMappingURL=badges.d.ts.map