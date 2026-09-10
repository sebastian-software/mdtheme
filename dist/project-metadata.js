import { globSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord, parseJson, parseTomlManifest, parseYamlFile, regularFile, } from "./project-files.js";
import { hasRustDocs, licenseMetadata } from "./project-package-details.js";
import { discoverRepository, discoverWorkflow } from "./project-repository.js";
const NPM_MANIFEST = "package.json";
const CARGO_MANIFEST = "Cargo.toml";
const GLOB_EXCLUDES = ["**/node_modules/**", "**/.git/**"];
function asString(value) {
    return typeof value === "string" ? value : undefined;
}
function asStringArray(value, label) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value)) {
        throw new TypeError(`${label} must be an array of strings`);
    }
    const strings = [];
    for (const item of value) {
        if (typeof item !== "string")
            throw new TypeError(`${label} must be an array of strings`);
        strings.push(item);
    }
    return strings;
}
function packageName(manifest, path, explicit) {
    const name = asString(manifest.name);
    if (name !== undefined && name.length > 0)
        return name;
    if (explicit)
        throw new TypeError(`${path} must define a non-empty package name`);
    return undefined;
}
function hasPlatformConstraint(manifest) {
    return ["os", "cpu", "libc"].some((key) => manifest[key] !== undefined);
}
function npmIsPublishable(manifest) {
    return manifest.private !== true && !hasPlatformConstraint(manifest);
}
function npmMetadata(manifest, path, options) {
    const name = packageName(manifest, path, options.explicit);
    if (name === undefined || !npmIsPublishable(manifest))
        return undefined;
    const engines = isRecord(manifest.engines) ? asString(manifest.engines.node) : undefined;
    return {
        registry: "npm",
        name,
        ...(engines === undefined ? {} : { runtime: engines }),
        ...licenseMetadata(manifest.license, options.root, path),
    };
}
function optionalDependencyNames(manifest) {
    const dependencies = manifest.optionalDependencies;
    if (dependencies === undefined)
        return new Set();
    if (!isRecord(dependencies))
        throw new TypeError("optionalDependencies must be an object");
    return new Set(Object.keys(dependencies));
}
function cargoPackage(manifest) {
    if (!isRecord(manifest.package))
        return undefined;
    return manifest.package;
}
function cargoIsPublishable(packageTable, workspace) {
    const declared = packageTable.publish;
    const publish = isRecord(declared) && declared.workspace === true ? workspace?.publish : declared;
    if (publish === false)
        return false;
    return !Array.isArray(publish) || publish.includes("crates-io");
}
function cargoField(packageTable, workspace, field) {
    const value = packageTable[field];
    if (typeof value === "string")
        return value;
    if (isRecord(value) && value.workspace === true && workspace !== undefined) {
        return asString(workspace[field]);
    }
    return undefined;
}
function cargoMetadata(manifest, path, options) {
    const packageTable = cargoPackage(manifest);
    if (packageTable === undefined || !cargoIsPublishable(packageTable, options.workspacePackage))
        return undefined;
    const name = packageName(packageTable, path, options.explicit);
    if (name === undefined)
        return undefined;
    const runtime = cargoField(packageTable, options.workspacePackage, "rust-version");
    return {
        registry: "crates",
        name,
        ...(runtime === undefined ? {} : { runtime }),
        ...licenseMetadata(cargoField(packageTable, options.workspacePackage, "license"), options.root, path),
        ...(hasRustDocs(manifest, path) ? { docs: true } : {}),
    };
}
function projectRoot(root) {
    if (root instanceof URL)
        return dirname(fileURLToPath(root));
    if (root.startsWith("file:"))
        return dirname(fileURLToPath(new URL(root)));
    if (root.includes("://"))
        throw new TypeError(`Unsupported project URL: ${root}`);
    return resolve(root);
}
function workspacePatterns(manifest, key, label) {
    const value = manifest[key];
    if (value === undefined)
        return [];
    const patterns = isRecord(value) && key === "workspaces" ? value.packages : value;
    return asStringArray(patterns, label) ?? [];
}
function expandManifests(root, pattern, fileName) {
    const candidate = pattern === "." ? fileName : `${pattern.replace(/\/$/u, "")}/${fileName}`;
    return globSync(candidate, { cwd: root, exclude: GLOB_EXCLUDES }).map((path) => resolve(root, path));
}
function packageManifests(root, patterns, fileName) {
    const included = patterns.filter((pattern) => !pattern.startsWith("!"));
    const excluded = new Set(patterns
        .filter((pattern) => pattern.startsWith("!"))
        .flatMap((pattern) => expandManifests(root, pattern.slice(1), fileName)));
    return [...new Set(included.flatMap((pattern) => expandManifests(root, pattern, fileName)))]
        .filter((path) => !excluded.has(path) && regularFile(path))
        .sort();
}
function explicitManifestPath(root, value) {
    if (isAbsolute(value))
        throw new TypeError(`Package manifest path must be relative to ${root}: ${value}`);
    const candidate = resolve(root, value);
    const relativePath = relative(root, candidate);
    if (relativePath === "" ||
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)) {
        throw new TypeError(`Package manifest path must stay inside ${root}: ${value}`);
    }
    if (regularFile(candidate) &&
        (basename(candidate) === NPM_MANIFEST || basename(candidate) === CARGO_MANIFEST))
        return candidate;
    throw new Error(`Package manifest does not exist: ${value}`);
}
function explicitPackages(root, paths) {
    const manifests = paths.map((path) => explicitManifestPath(root, path));
    const rootCargoPath = resolve(root, CARGO_MANIFEST);
    const rootCargo = regularFile(rootCargoPath) ? parseTomlManifest(rootCargoPath) : undefined;
    const workspacePackage = rootCargo !== undefined &&
        isRecord(rootCargo.workspace) &&
        isRecord(rootCargo.workspace.package)
        ? rootCargo.workspace.package
        : undefined;
    const result = [];
    for (const path of manifests) {
        const metadata = basename(path) === NPM_MANIFEST
            ? npmMetadata(parseJson(path), path, { root, explicit: true })
            : cargoMetadata(parseTomlManifest(path), path, { root, explicit: true, workspacePackage });
        if (metadata !== undefined)
            result.push(metadata);
    }
    return dedupePackages(result);
}
function defaultNpmPackages(root, rootManifest) {
    if (rootManifest !== undefined) {
        const rootMetadata = npmMetadata(rootManifest, resolve(root, NPM_MANIFEST), {
            root,
            explicit: false,
        });
        if (rootMetadata !== undefined)
            return [rootMetadata];
    }
    const patterns = rootManifest === undefined
        ? []
        : workspacePatterns(rootManifest, "workspaces", "package.json workspaces");
    const workspaceFile = resolve(root, "pnpm-workspace.yaml");
    if (patterns.length === 0 && regularFile(workspaceFile)) {
        const workspace = parseYamlFile(workspaceFile);
        patterns.push(...workspacePatterns(workspace, "packages", "pnpm-workspace.yaml packages"));
    }
    const manifests = packageManifests(root, patterns, NPM_MANIFEST);
    const parsed = manifests.map((path) => ({ path, manifest: parseJson(path) }));
    const allManifests = [rootManifest, ...parsed.map((item) => item.manifest)].filter((item) => item !== undefined);
    const optionalTargets = new Set(allManifests.flatMap((manifest) => [...optionalDependencyNames(manifest)]));
    return dedupePackages(parsed.flatMap(({ path, manifest }) => {
        const metadata = npmMetadata(manifest, path, { root, explicit: false });
        return metadata !== undefined && !optionalTargets.has(metadata.name) ? [metadata] : [];
    }));
}
function cargoWorkspaceMembers(root, workspace) {
    const defaultMembers = asStringArray(workspace["default-members"], "Cargo workspace default-members");
    const members = asStringArray(workspace.members, "Cargo workspace members") ?? [];
    const selected = defaultMembers !== undefined && defaultMembers.length > 0 ? defaultMembers : members;
    const excluded = new Set(packageManifests(root, asStringArray(workspace.exclude, "Cargo workspace exclude") ?? [], CARGO_MANIFEST));
    return packageManifests(root, selected, CARGO_MANIFEST).filter((path) => !excluded.has(path));
}
function defaultCargoPackages(root) {
    const rootPath = resolve(root, CARGO_MANIFEST);
    if (!regularFile(rootPath))
        return [];
    const manifest = parseTomlManifest(rootPath);
    const workspacePackage = isRecord(manifest.workspace) && isRecord(manifest.workspace.package)
        ? manifest.workspace.package
        : undefined;
    const rootMetadata = cargoMetadata(manifest, rootPath, {
        root,
        explicit: false,
        workspacePackage,
    });
    if (rootMetadata !== undefined)
        return [rootMetadata];
    if (!isRecord(manifest.workspace))
        return [];
    return dedupePackages(cargoWorkspaceMembers(root, manifest.workspace).flatMap((path) => {
        const child = parseTomlManifest(path);
        const metadata = cargoMetadata(child, path, { root, explicit: false, workspacePackage });
        return metadata === undefined ? [] : [metadata];
    }));
}
function dedupePackages(packages) {
    const seen = new Set();
    return packages.filter((item) => {
        const key = `${item.registry}:${item.name}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/** Discover public npm/crates packages and project wiring without executing project code. */
export function discoverProject(root, packages) {
    const projectRootPath = projectRoot(root);
    const npmPath = resolve(projectRootPath, NPM_MANIFEST);
    const cargoPath = resolve(projectRootPath, CARGO_MANIFEST);
    const npm = regularFile(npmPath) ? parseJson(npmPath) : undefined;
    const cargo = regularFile(cargoPath) ? parseTomlManifest(cargoPath) : undefined;
    const discovered = packages === undefined
        ? [...defaultNpmPackages(projectRootPath, npm), ...defaultCargoPackages(projectRootPath)]
        : explicitPackages(projectRootPath, packages);
    const metadata = { packages: dedupePackages(discovered) };
    const repository = discoverRepository(projectRootPath, npm, cargo);
    if (repository !== undefined)
        metadata.repository = repository;
    const workflow = discoverWorkflow(projectRootPath);
    if (workflow !== undefined)
        metadata.workflow = workflow;
    return metadata;
}
//# sourceMappingURL=project-metadata.js.map