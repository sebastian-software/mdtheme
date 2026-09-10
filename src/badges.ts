import type { MarkdownFrame } from "./core.js";

import { discoverProject } from "./project-metadata.js";

const SHIELDS = "https://img.shields.io";
const RUNTIME_COLOR = "005164";

export type ProjectBadgesOptions = {
  packages?: readonly string[];
  published?: boolean;
  workflow?: string;
};

type ProjectPackage = ReturnType<typeof discoverProject>["packages"][number];

function encodePathPart(value: string): string {
  return encodeURIComponent(value).replaceAll(
    /[!'()*]/gu,
    (character) => `%${character.codePointAt(0)?.toString(16).toUpperCase() ?? ""}`,
  );
}

function encodeStaticPart(value: string): string {
  return encodePathPart(value).replaceAll("-", "--").replaceAll("_", "__");
}

function escapeLabel(value: string): string {
  return value.replaceAll(/[\\[\]]/gu, "\\$&");
}

function imageLink(label: string, image: string, target: string): string {
  return `[![${escapeLabel(label)}](${image})](${target})`;
}

function packageBadge(item: ProjectPackage): string | undefined {
  if (item.name.length === 0) return;
  const packagePath = encodePathPart(item.name);
  if (item.registry === "npm") {
    return imageLink(
      `npm ${item.name}`,
      `${SHIELDS}/npm/v/${packagePath}.svg?style=flat&label=${encodePathPart(`npm: ${item.name}`)}`,
      `https://www.npmjs.com/package/${packagePath}`,
    );
  }
  return imageLink(
    `crates.io ${item.name}`,
    `${SHIELDS}/crates/v/${packagePath}.svg?style=flat&label=${encodePathPart(`crates.io: ${item.name}`)}`,
    `https://crates.io/crates/${packagePath}`,
  );
}

function downloadBadge(item: ProjectPackage): string {
  const packagePath = encodePathPart(item.name);
  const npm = item.registry === "npm";
  const label = `${npm ? "npm monthly" : "crates.io recent"} downloads: ${item.name}`;
  return imageLink(
    label,
    `${SHIELDS}/${npm ? "npm/dm" : "crates/dr"}/${packagePath}.svg?style=flat&label=${encodePathPart(label)}`,
    npm
      ? `https://www.npmjs.com/package/${packagePath}`
      : `https://crates.io/crates/${packagePath}`,
  );
}

function docsBadge(item: ProjectPackage): string {
  const packagePath = encodePathPart(item.name);
  const label = `docs.rs: ${item.name}`;
  return imageLink(
    label,
    `${SHIELDS}/docsrs/${packagePath}?style=flat&label=${encodePathPart(label)}`,
    `https://docs.rs/${packagePath}`,
  );
}

function licenseBadges(packages: readonly ProjectPackage[]): string[] {
  return packages.flatMap((item) => {
    if (item.license === undefined) return [];
    const { expression, manifest } = item.license;
    const label = packages.length === 1 ? "License" : `License (${item.registry}: ${item.name})`;
    return [
      imageLink(
        `${label}: ${expression}`,
        `${SHIELDS}/badge/${encodeStaticPart(label)}-${encodeStaticPart(expression)}-${RUNTIME_COLOR}.svg?style=flat`,
        manifest
          .split("/")
          .map((part) => encodePathPart(part))
          .join("/"),
      ),
    ];
  });
}

function workflowName(workflow: string): string {
  const parts = workflow.split(/[\\/]/u);
  return parts.at(-1) ?? workflow;
}

function repositoryParts(repository: string | undefined): [string, string] | undefined {
  if (repository === undefined) return;
  const parts = repository.split("/");
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) return;
  const owner = parts[0];
  const repo = parts[1];
  if (owner === undefined || repo === undefined) return;
  return [encodePathPart(owner), encodePathPart(repo)];
}

function workflowBadge(
  repository: string | undefined,
  workflow: string | undefined,
): string | undefined {
  const parts = repositoryParts(repository);
  if (parts === undefined || workflow === undefined || workflow.length === 0) return;
  const workflowPath = encodePathPart(workflowName(workflow));
  const [owner, repo] = parts;
  return imageLink(
    "GitHub Actions",
    `${SHIELDS}/github/actions/workflow/status/${owner}/${repo}/${workflowPath}?style=flat`,
    `https://github.com/${owner}/${repo}/actions/workflows/${workflowPath}`,
  );
}

function runtimeBadge(
  registry: ProjectPackage["registry"],
  runtime: string,
  packageName?: string,
): string {
  const ecosystem = registry === "npm" ? "Node.js" : "Rust MSRV";
  const label =
    packageName === undefined
      ? `${ecosystem} ${runtime}`
      : `${ecosystem} ${runtime} (${packageName})`;
  const message = packageName === undefined ? runtime : `${runtime} (${packageName})`;
  return imageLink(
    label,
    `${SHIELDS}/badge/${encodeStaticPart(ecosystem)}-${encodeStaticPart(message)}-${RUNTIME_COLOR}.svg?style=flat`,
    registry === "npm" ? "https://nodejs.org/" : "https://www.rust-lang.org/",
  );
}

function runtimeBadges(packages: readonly ProjectPackage[]): string[] {
  const runtimes = new Map<
    string,
    { registry: ProjectPackage["registry"]; runtime: string; names: string[] }
  >();
  for (const item of packages) {
    if (item.runtime === undefined || item.runtime.length === 0) continue;
    const key = `${item.registry}\u0000${item.runtime}`;
    const current = runtimes.get(key);
    if (current === undefined) {
      runtimes.set(key, { registry: item.registry, runtime: item.runtime, names: [item.name] });
    } else {
      current.names.push(item.name);
    }
  }

  const byRegistry = new Map<ProjectPackage["registry"], number>();
  for (const { registry } of runtimes.values()) {
    byRegistry.set(registry, (byRegistry.get(registry) ?? 0) + 1);
  }
  return [...runtimes.values()].map(({ registry, runtime, names }) => {
    if (byRegistry.get(registry) === 1) return runtimeBadge(registry, runtime);
    return runtimeBadge(registry, runtime, names.join(", "));
  });
}

function publishedBadges(packages: readonly ProjectPackage[]): string[] {
  const badges: string[] = [];
  for (const item of packages) {
    const badge = packageBadge(item);
    if (badge !== undefined) badges.push(badge);
    badges.push(downloadBadge(item));
    if (item.registry === "crates" && item.docs === true) badges.push(docsBadge(item));
  }
  return badges;
}

/** Return a deterministic Markdown badge row for the discovered project. */
export function projectBadges(root: string | URL, options?: ProjectBadgesOptions): MarkdownFrame {
  const project = discoverProject(root, options?.packages);
  const badges: string[] = [];

  if (options?.published !== false) badges.push(...publishedBadges(project.packages));

  const workflow = options?.workflow ?? project.workflow;
  const ci = workflowBadge(project.repository, workflow);
  if (ci !== undefined) badges.push(ci);
  badges.push(...runtimeBadges(project.packages));
  badges.push(...licenseBadges(project.packages));

  return { opening: badges.join(" "), closing: "" };
}
