import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { regularFile } from "./project-files.js";

type Manifest = Record<string, unknown>;

function isRecord(value: unknown): value is Manifest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function repositoryPair(value: string): string | undefined {
  const trimmed = value.replace(/\/$/u, "").replace(/\.git$/u, "");
  const [owner, name, ...extra] = trimmed.split("/");
  return owner !== undefined &&
    name !== undefined &&
    extra.length === 0 &&
    owner.length > 0 &&
    name.length > 0
    ? `${owner}/${name}`
    : undefined;
}

function normalizeRepository(value: unknown): string | undefined {
  const raw =
    typeof value === "string" ? value : isRecord(value) ? stringValue(value.url) : undefined;
  if (raw === undefined) return undefined;
  const cleaned = raw.trim().replace(/^git\+/u, "");
  const shorthand = cleaned.startsWith("github:")
    ? repositoryPair(cleaned.slice("github:".length))
    : undefined;
  if (shorthand !== undefined) return shorthand;
  const scp = /^git@github\.com:(.+)$/iu.exec(cleaned);
  const scpPath = scp?.[1];
  if (scpPath !== undefined) return repositoryPair(scpPath);
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.toLowerCase() !== "github.com") return undefined;
    return repositoryPair(parsed.pathname.slice(1));
  } catch {
    return repositoryPair(cleaned);
  }
}

function table(manifest: Manifest | undefined, key: string): Manifest | undefined {
  return manifest !== undefined && isRecord(manifest[key]) ? manifest[key] : undefined;
}

/** Normalize a manifest repository, falling back to a bounded local Git query. */
export function discoverRepository(
  root: string,
  npm: Manifest | undefined,
  cargo: Manifest | undefined,
): string | undefined {
  const repository =
    normalizeRepository(npm?.repository) ??
    normalizeRepository(table(cargo, "package")?.repository) ??
    normalizeRepository(table(table(cargo, "workspace"), "package")?.repository);
  if (repository !== undefined) return repository;
  try {
    const remote = execFileSync("git", ["-C", root, "config", "--get", "remote.origin.url"], {
      encoding: "utf8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return normalizeRepository(remote);
  } catch {
    return undefined;
  }
}

/** Find the preferred CI workflow, leaving ambiguous custom workflow sets unset. */
export function discoverWorkflow(root: string): string | undefined {
  const workflowRoot = resolve(root, ".github", "workflows");
  for (const fileName of ["ci.yml", "ci.yaml"]) {
    if (regularFile(resolve(workflowRoot, fileName))) return fileName;
  }
  let entries: string[];
  try {
    // Workflow discovery reads only the selected project's fixed workflow directory.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    entries = readdirSync(workflowRoot);
  } catch {
    return undefined;
  }
  const workflows = entries.filter(
    (entry) => /\.ya?ml$/u.test(entry) && regularFile(resolve(workflowRoot, entry)),
  );
  return workflows.length === 1 ? workflows[0] : undefined;
}
