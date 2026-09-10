#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { loadConfig } from "./config.js";
import { checkFiles, writeFiles } from "./files.js";
import { runPrePush } from "./pre-push.js";

export type CliIO = {
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
};

export type ParsedCli = {
  readonly operation: "check" | "help" | "pre-push" | "version" | "write";
  readonly configPath: string | undefined;
};

export const HELP = `Usage: mdtheme <operation> [options]

Operations:
  pre-push            Regenerate README.md and require a clean, committed worktree
  --write             Render the source and atomically update README.md
  --check             Render the source and check README.md for drift
  --help              Show this help
  --version           Show the installed version

Options:
  --config PATH       Load a TypeScript or JavaScript config from PATH
`;

type ParseState = {
  operation: ParsedCli["operation"] | undefined;
  configPath: string | undefined;
};

const OPERATIONS = new Map<string, ParsedCli["operation"]>([
  ["pre-push", "pre-push"],
  ["--check", "check"],
  ["--help", "help"],
  ["--version", "version"],
  ["--write", "write"],
  ["-h", "help"],
  ["-v", "version"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function operationFor(argument: string): ParsedCli["operation"] | undefined {
  return OPERATIONS.get(argument);
}

function assignOperation(state: ParseState, operation: ParsedCli["operation"]): void {
  if (state.operation !== undefined) throw new Error("Exactly one operation must be specified");
  state.operation = operation;
}

function assignConfig(state: ParseState, value: string | undefined): void {
  if (value === undefined || value.length === 0 || value.startsWith("-")) {
    throw new Error("--config requires a path");
  }
  if (state.configPath !== undefined) throw new Error("--config may only be specified once");
  state.configPath = value;
}

function consumeArgument(argv: readonly string[], index: number, state: ParseState): number {
  const argument = argv[index];
  if (argument === undefined || argument.length === 0) throw new Error("Unknown empty argument");
  const operation = operationFor(argument);
  if (operation !== undefined) {
    assignOperation(state, operation);
    return index;
  }
  if (argument === "--config") {
    assignConfig(state, argv[index + 1]);
    return index + 1;
  }
  if (argument.startsWith("--config=")) {
    assignConfig(state, argument.slice("--config=".length));
    return index;
  }
  throw new Error(`Unknown argument: ${argument}`);
}

function parseArgs(argv: readonly string[]): ParsedCli {
  const state: ParseState = { operation: undefined, configPath: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    index = consumeArgument(argv, index, state);
  }
  if (state.operation === undefined) throw new Error("Exactly one operation must be specified");
  return { operation: state.operation, configPath: state.configPath };
}

function packageVersion(): string {
  const require = createRequire(import.meta.url);
  const metadata: unknown = require("../package.json");
  const version = isRecord(metadata) ? metadata.version : undefined;
  if (typeof version !== "string") throw new Error("Cannot determine package version");
  return version;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function execute(parsed: ParsedCli, io: Required<CliIO>): Promise<number> {
  if (parsed.operation === "pre-push") return runPrePush(parsed.configPath, io);
  const config = await loadConfig(parsed.configPath);
  if (parsed.operation === "check") {
    const drift = await checkFiles(config);
    if (drift) {
      const configOption =
        parsed.configPath === undefined ? "" : ` --config ${shellQuote(parsed.configPath)}`;
      io.stderr(`${config.output} is out of date.`);
      io.stderr(`Run mdtheme --write${configOption}.`);
      return 1;
    }
    io.stdout(`${config.output} is up to date.`);
    return 0;
  }
  const changed = await writeFiles(config);
  io.stdout(changed ? `Updated ${config.output}.` : `${config.output} is up to date.`);
  return 0;
}

function parseOrReport(argv: readonly string[], io: Required<CliIO>): null | ParsedCli {
  try {
    return parseArgs(argv);
  } catch (error) {
    io.stderr(`mdtheme: ${error instanceof Error ? error.message : String(error)}`);
    io.stderr("Run mdtheme --help for usage.");
    return null;
  }
}

function runInformational(parsed: ParsedCli, io: Required<CliIO>): null | number {
  if (parsed.operation === "help") {
    io.stdout(HELP.trimEnd());
    return 0;
  }
  if (parsed.operation === "version") {
    io.stdout(packageVersion());
    return 0;
  }
  return null;
}

export async function runCli(
  argv: readonly string[] = process.argv.slice(2),
  io: CliIO = {},
): Promise<number> {
  const output: Required<CliIO> = {
    stdout: io.stdout ?? ((text: string) => process.stdout.write(`${text}\n`)),
    stderr: io.stderr ?? ((text: string) => process.stderr.write(`${text}\n`)),
  };
  const parsed = parseOrReport(argv, output);
  if (parsed === null) return 2;
  try {
    const informational = runInformational(parsed, output);
    if (informational !== null) return informational;
    return await execute(parsed, output);
  } catch (error) {
    output.stderr(`mdtheme: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.filename === realpathSync(resolve(process.argv[1]))
) {
  process.exitCode = await runCli();
}
