import type { Manifest } from "./project-files.js";
export type PackageLicense = {
    expression: string;
    manifest: string;
};
export declare function licenseMetadata(value: unknown, root: string, path: string): {
    license?: PackageLicense;
};
export declare function hasRustDocs(manifest: Manifest, path: string): boolean;
//# sourceMappingURL=project-package-details.d.ts.map