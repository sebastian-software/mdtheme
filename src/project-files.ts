import { lstatSync, readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

export type Manifest = Record<string, unknown>;

export function isRecord(value: unknown): value is Manifest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJson(path: string): Manifest {
  try {
    // Manifest paths are selected from the project root or its workspace globs.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(value)) throw new TypeError("the manifest must contain an object");
    return value;
  } catch (error) {
    throw new Error(`Unable to read ${path}: ${errorMessage(error)}`, { cause: error });
  }
}

export function parseTomlManifest(path: string): Manifest {
  try {
    // Manifest paths are selected from the project root or its workspace globs.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const value: unknown = parseToml(readFileSync(path, "utf8"));
    if (!isRecord(value)) throw new TypeError("the manifest must contain a table");
    return value;
  } catch (error) {
    throw new Error(`Unable to read ${path}: ${errorMessage(error)}`, { cause: error });
  }
}

export function parseYamlFile(path: string): Manifest {
  try {
    // The workspace path is fixed beneath the selected project root.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const value: unknown = parseYaml(readFileSync(path, "utf8"));
    if (!isRecord(value)) throw new TypeError("the workspace file must contain a mapping");
    return value;
  } catch (error) {
    throw new Error(`Unable to read ${path}: ${errorMessage(error)}`, { cause: error });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function regularFile(path: string): boolean {
  try {
    // Candidate paths are constrained to the selected project root.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}
