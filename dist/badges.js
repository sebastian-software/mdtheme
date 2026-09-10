import { discoverProject } from "./project-metadata.js";
const SHIELDS = "https://img.shields.io";
const RUNTIME_COLOR = "005164";
function encodePathPart(value) {
    return encodeURIComponent(value).replaceAll(/[!'()*]/gu, (character) => `%${character.codePointAt(0)?.toString(16).toUpperCase() ?? ""}`);
}
function encodeStaticPart(value) {
    return encodePathPart(value).replaceAll("-", "--").replaceAll("_", "__");
}
function escapeLabel(value) {
    return value.replaceAll(/[\\[\]]/gu, "\\$&");
}
function imageLink(label, image, target) {
    return `[![${escapeLabel(label)}](${image})](${target})`;
}
function packageBadge(item) {
    if (item.name.length === 0)
        return;
    const packagePath = encodePathPart(item.name);
    if (item.registry === "npm") {
        return imageLink(`npm ${item.name}`, `${SHIELDS}/npm/v/${packagePath}.svg?style=flat&label=${encodePathPart(`npm: ${item.name}`)}`, `https://www.npmjs.com/package/${packagePath}`);
    }
    return imageLink(`crates.io ${item.name}`, `${SHIELDS}/crates/v/${packagePath}.svg?style=flat&label=${encodePathPart(`crates.io: ${item.name}`)}`, `https://crates.io/crates/${packagePath}`);
}
function workflowName(workflow) {
    const parts = workflow.split(/[\\/]/u);
    return parts.at(-1) ?? workflow;
}
function repositoryParts(repository) {
    if (repository === undefined)
        return;
    const parts = repository.split("/");
    if (parts.length !== 2 || parts.some((part) => part.length === 0))
        return;
    const owner = parts[0];
    const repo = parts[1];
    if (owner === undefined || repo === undefined)
        return;
    return [encodePathPart(owner), encodePathPart(repo)];
}
function workflowBadge(repository, workflow) {
    const parts = repositoryParts(repository);
    if (parts === undefined || workflow === undefined || workflow.length === 0)
        return;
    const workflowPath = encodePathPart(workflowName(workflow));
    const [owner, repo] = parts;
    return imageLink("GitHub Actions", `${SHIELDS}/github/actions/workflow/status/${owner}/${repo}/${workflowPath}?style=flat`, `https://github.com/${owner}/${repo}/actions/workflows/${workflowPath}`);
}
function runtimeBadge(registry, runtime, packageName) {
    const ecosystem = registry === "npm" ? "Node.js" : "Rust MSRV";
    const label = packageName === undefined
        ? `${ecosystem} ${runtime}`
        : `${ecosystem} ${runtime} (${packageName})`;
    const message = packageName === undefined ? runtime : `${runtime} (${packageName})`;
    return imageLink(label, `${SHIELDS}/badge/${encodeStaticPart(ecosystem)}-${encodeStaticPart(message)}-${RUNTIME_COLOR}.svg?style=flat`, registry === "npm" ? "https://nodejs.org/" : "https://www.rust-lang.org/");
}
function runtimeBadges(packages) {
    const runtimes = new Map();
    for (const item of packages) {
        if (item.runtime === undefined || item.runtime.length === 0)
            continue;
        const key = `${item.registry}\u0000${item.runtime}`;
        const current = runtimes.get(key);
        if (current === undefined) {
            runtimes.set(key, { registry: item.registry, runtime: item.runtime, names: [item.name] });
        }
        else {
            current.names.push(item.name);
        }
    }
    const byRegistry = new Map();
    for (const { registry } of runtimes.values()) {
        byRegistry.set(registry, (byRegistry.get(registry) ?? 0) + 1);
    }
    return [...runtimes.values()].map(({ registry, runtime, names }) => {
        if (byRegistry.get(registry) === 1)
            return runtimeBadge(registry, runtime);
        return runtimeBadge(registry, runtime, names.join(", "));
    });
}
/** Return a deterministic Markdown badge row for the discovered project. */
export function projectBadges(root, options) {
    const project = discoverProject(root, options?.packages);
    const badges = [];
    if (options?.published !== false) {
        for (const item of project.packages) {
            const badge = packageBadge(item);
            if (badge !== undefined)
                badges.push(badge);
        }
    }
    const workflow = options?.workflow ?? project.workflow;
    const ci = workflowBadge(project.repository, workflow);
    if (ci !== undefined)
        badges.push(ci);
    badges.push(...runtimeBadges(project.packages));
    return { opening: badges.join(" "), closing: "" };
}
//# sourceMappingURL=badges.js.map