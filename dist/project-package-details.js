import { dirname, relative, resolve, sep } from "node:path";
import { isRecord, regularFile } from "./project-files.js";
export function licenseMetadata(value, root, path) {
    if (typeof value !== "string" || value.trim().length === 0)
        return {};
    return {
        license: { expression: value.trim(), manifest: relative(root, path).split(sep).join("/") },
    };
}
export function hasRustDocs(manifest, path) {
    const lib = isRecord(manifest.lib) ? manifest.lib : undefined;
    if (lib?.doc === false)
        return false;
    if (lib === undefined && isRecord(manifest.package) && manifest.package.autolib === false)
        return false;
    return regularFile(resolve(dirname(path), typeof lib?.path === "string" ? lib.path : "src/lib.rs"));
}
//# sourceMappingURL=project-package-details.js.map