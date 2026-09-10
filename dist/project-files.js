import { lstatSync, readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseJson(path) {
    try {
        // Manifest paths are selected from the project root or its workspace globs.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const value = JSON.parse(readFileSync(path, "utf8"));
        if (!isRecord(value))
            throw new TypeError("the manifest must contain an object");
        return value;
    }
    catch (error) {
        throw new Error(`Unable to read ${path}: ${errorMessage(error)}`, { cause: error });
    }
}
export function parseTomlManifest(path) {
    try {
        // Manifest paths are selected from the project root or its workspace globs.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const value = parseToml(readFileSync(path, "utf8"));
        if (!isRecord(value))
            throw new TypeError("the manifest must contain a table");
        return value;
    }
    catch (error) {
        throw new Error(`Unable to read ${path}: ${errorMessage(error)}`, { cause: error });
    }
}
export function parseYamlFile(path) {
    try {
        // The workspace path is fixed beneath the selected project root.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const value = parseYaml(readFileSync(path, "utf8"));
        if (!isRecord(value))
            throw new TypeError("the workspace file must contain a mapping");
        return value;
    }
    catch (error) {
        throw new Error(`Unable to read ${path}: ${errorMessage(error)}`, { cause: error });
    }
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function regularFile(path) {
    try {
        // Candidate paths are constrained to the selected project root.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return lstatSync(path).isFile();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=project-files.js.map