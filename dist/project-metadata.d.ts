import type { PackageLicense } from "./project-package-details.js";
/** A publishable package discovered from a project manifest. */
export type PackageMetadata = {
    registry: "crates" | "npm";
    name: string;
    runtime?: string;
    license?: PackageLicense;
    docs?: true;
};
/** Public package and repository metadata used by the README theme. */
export type ProjectMetadata = {
    packages: PackageMetadata[];
    repository?: string;
    workflow?: string;
};
/** Discover public npm/crates packages and project wiring without executing project code. */
export declare function discoverProject(root: string | URL, packages?: readonly string[]): ProjectMetadata;
//# sourceMappingURL=project-metadata.d.ts.map