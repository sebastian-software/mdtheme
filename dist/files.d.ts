import type { ResolvedConfig } from "./config.js";
export declare class FileOperationError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
/** Return whether the configured README needs to be updated. */
export declare function checkFiles(config: ResolvedConfig): Promise<boolean>;
/** Render and atomically write the configured README when it has changed. */
export declare function writeFiles(config: ResolvedConfig): Promise<boolean>;
//# sourceMappingURL=files.d.ts.map