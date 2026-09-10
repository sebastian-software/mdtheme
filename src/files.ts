import type { Stats } from "node:fs";
import type { FileHandle } from "node:fs/promises";

import { randomUUID } from "node:crypto";
import { lstat, open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { ResolvedConfig } from "./config.js";

import { renderMarkdown } from "./core.js";

export class FileOperationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FileOperationError";
  }
}

type PreparedFile = {
  readonly config: ResolvedConfig;
  readonly content: string;
  readonly existing: string | undefined;
  readonly outputMode: number;
};

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !("code" in error)) return;
  const code = error.code;
  return typeof code === "string" ? code : undefined;
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw error;
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function validateDirectory(config: ResolvedConfig): Promise<void> {
  const outputDirectory = dirname(config.output);
  try {
    const directory = await stat(outputDirectory);
    if (!directory.isDirectory()) {
      throw new FileOperationError(`Output parent is not a directory: ${outputDirectory}`);
    }
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(
      `Cannot access output directory ${outputDirectory}: ${readableError(error)}`,
      { cause: error },
    );
  }
}

async function validateSource(config: ResolvedConfig): Promise<Stats> {
  try {
    const sourceInfo = await lstat(config.source);
    if (!sourceInfo.isFile() && !sourceInfo.isSymbolicLink()) {
      throw new FileOperationError(`Source is not a regular file: ${config.source}`);
    }
    const sourceStat = await stat(config.source);
    if (!sourceStat.isFile()) {
      throw new FileOperationError(`Source does not resolve to a regular file: ${config.source}`);
    }
    return sourceStat;
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    if (errorCode(error) === "ENOENT") {
      throw new FileOperationError(`Source file does not exist: ${config.source}`);
    }
    throw new FileOperationError(`Cannot access source ${config.source}: ${readableError(error)}`, {
      cause: error,
    });
  }
}

async function ensureDistinct(config: ResolvedConfig, sourceStat: Stats): Promise<void> {
  const outputStat = await stat(config.output);
  if (sourceStat.dev === outputStat.dev && sourceStat.ino === outputStat.ino) {
    throw new FileOperationError("Source and output refer to the same file");
  }
  try {
    const [sourceReal, outputReal] = await Promise.all([
      realpath(config.source),
      realpath(config.output),
    ]);
    if (sourceReal === outputReal) {
      throw new FileOperationError("Source and output resolve to the same file");
    }
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(`Cannot resolve source/output paths: ${readableError(error)}`, {
      cause: error,
    });
  }
}

async function validateOutput(
  config: ResolvedConfig,
  sourceStat: Stats,
): Promise<{ outputMode: number; existing: string | undefined }> {
  const outputInfo = await lstatIfPresent(config.output);
  if (outputInfo === undefined) return { outputMode: 0o644, existing: undefined };
  validateOutputType(config, outputInfo);
  await validateOutputDistinct(config, sourceStat);
  return { outputMode: outputInfo.mode, existing: await readOutput(config) };
}

function validateOutputType(config: ResolvedConfig, outputInfo: Stats): void {
  if (outputInfo.isSymbolicLink()) {
    throw new FileOperationError(`Output must not be a symlink: ${config.output}`);
  }
  if (!outputInfo.isFile()) {
    throw new FileOperationError(`Output is not a regular file: ${config.output}`);
  }
}

async function validateOutputDistinct(config: ResolvedConfig, sourceStat: Stats): Promise<void> {
  try {
    await ensureDistinct(config, sourceStat);
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    throw new FileOperationError(`Cannot access output ${config.output}: ${readableError(error)}`, {
      cause: error,
    });
  }
}

async function readOutput(config: ResolvedConfig): Promise<string> {
  try {
    return await readFile(config.output, "utf8");
  } catch (error) {
    throw new FileOperationError(`Cannot read output ${config.output}: ${readableError(error)}`, {
      cause: error,
    });
  }
}

async function validatePaths(
  config: ResolvedConfig,
): Promise<{ outputMode: number; existing: string | undefined }> {
  await validateDirectory(config);
  const sourceStat = await validateSource(config);
  return validateOutput(config, sourceStat);
}

async function prepare(config: ResolvedConfig): Promise<PreparedFile> {
  const paths = await validatePaths(config);
  let source;
  try {
    source = await readFile(config.source, "utf8");
  } catch (error) {
    throw new FileOperationError(`Cannot read source ${config.source}: ${readableError(error)}`, {
      cause: error,
    });
  }
  let content: string;
  try {
    content = await renderMarkdown(source, config.themes, { sourceName: basename(config.source) });
  } catch (error) {
    throw new FileOperationError(`Cannot render ${config.source}: ${readableError(error)}`, {
      cause: error,
    });
  }
  return { config, content, existing: paths.existing, outputMode: paths.outputMode };
}

/** Return whether the configured README needs to be updated. */
export async function checkFiles(config: ResolvedConfig): Promise<boolean> {
  const prepared = await prepare(config);
  return prepared.existing !== prepared.content;
}

async function writeAndClose(handle: FileHandle, content: string): Promise<void> {
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
}

async function removeTemporary(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

async function atomicallyWrite(config: ResolvedConfig, prepared: PreparedFile): Promise<void> {
  const temporary = join(
    dirname(config.output),
    `.${basename(config.output)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let temporaryOwned = false;
  try {
    const handle = await open(temporary, "wx", prepared.outputMode);
    temporaryOwned = true;
    await writeAndClose(handle, prepared.content);
    await rename(temporary, config.output);
  } catch (error) {
    if (temporaryOwned) {
      try {
        await removeTemporary(temporary);
      } catch (cleanupError) {
        throw new FileOperationError(
          `Could not write ${config.output}: ${readableError(error)} (temporary cleanup failed: ${readableError(cleanupError)})`,
          { cause: cleanupError },
        );
      }
    }
    throw new FileOperationError(`Could not write ${config.output}: ${readableError(error)}`, {
      cause: error,
    });
  }
}

/** Render and atomically write the configured README when it has changed. */
export async function writeFiles(config: ResolvedConfig): Promise<boolean> {
  const prepared = await prepare(config);
  if (prepared.existing === prepared.content) return false;
  await atomicallyWrite(config, prepared);
  return true;
}
