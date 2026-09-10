import { dirname, relative, resolve, sep } from "node:path";

import type { Manifest } from "./project-files.js";

import { isRecord, regularFile } from "./project-files.js";

export type PackageLicense = { expression: string; manifest: string };

export function licenseMetadata(
  value: unknown,
  root: string,
  path: string,
): { license?: PackageLicense } {
  if (typeof value !== "string" || value.trim().length === 0) return {};
  return {
    license: { expression: value.trim(), manifest: relative(root, path).split(sep).join("/") },
  };
}

export function hasRustDocs(manifest: Manifest, path: string): boolean {
  const lib = isRecord(manifest.lib) ? manifest.lib : undefined;
  if (lib?.doc === false) return false;
  if (lib === undefined && isRecord(manifest.package) && manifest.package.autolib === false)
    return false;
  return regularFile(
    resolve(dirname(path), typeof lib?.path === "string" ? lib.path : "src/lib.rs"),
  );
}
