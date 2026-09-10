#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { checkFiles, writeFiles } from "./files.js";
export const HELP = `Usage: mdtheme <operation> [options]

Operations:
  --write             Render the source and atomically update README.md
  --check             Render the source and check README.md for drift
  --help              Show this help
  --version           Show the installed version

Options:
  --config PATH       Load a TypeScript or JavaScript config from PATH
`;
const OPERATIONS = new Map([
    ["--check", "check"],
    ["--help", "help"],
    ["--version", "version"],
    ["--write", "write"],
    ["-h", "help"],
    ["-v", "version"],
]);
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function operationFor(argument) {
    return OPERATIONS.get(argument);
}
function assignOperation(state, operation) {
    if (state.operation !== undefined)
        throw new Error("Exactly one operation must be specified");
    state.operation = operation;
}
function assignConfig(state, value) {
    if (value === undefined || value.length === 0 || value.startsWith("-")) {
        throw new Error("--config requires a path");
    }
    if (state.configPath !== undefined)
        throw new Error("--config may only be specified once");
    state.configPath = value;
}
function consumeArgument(argv, index, state) {
    const argument = argv[index];
    if (argument === undefined || argument.length === 0)
        throw new Error("Unknown empty argument");
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
function parseArgs(argv) {
    const state = { operation: undefined, configPath: undefined };
    for (let index = 0; index < argv.length; index += 1) {
        index = consumeArgument(argv, index, state);
    }
    if (state.operation === undefined)
        throw new Error("Exactly one operation must be specified");
    return { operation: state.operation, configPath: state.configPath };
}
function packageVersion() {
    const require = createRequire(import.meta.url);
    const metadata = require("../package.json");
    const version = isRecord(metadata) ? metadata.version : undefined;
    if (typeof version !== "string")
        throw new Error("Cannot determine package version");
    return version;
}
function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
async function execute(parsed, io) {
    const config = await loadConfig(parsed.configPath);
    if (parsed.operation === "check") {
        const drift = await checkFiles(config);
        if (drift) {
            const configOption = parsed.configPath === undefined ? "" : ` --config ${shellQuote(parsed.configPath)}`;
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
function parseOrReport(argv, io) {
    try {
        return parseArgs(argv);
    }
    catch (error) {
        io.stderr(`mdtheme: ${error instanceof Error ? error.message : String(error)}`);
        io.stderr("Run mdtheme --help for usage.");
        return null;
    }
}
function runInformational(parsed, io) {
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
export async function runCli(argv = process.argv.slice(2), io = {}) {
    const output = {
        stdout: io.stdout ?? ((text) => process.stdout.write(`${text}\n`)),
        stderr: io.stderr ?? ((text) => process.stderr.write(`${text}\n`)),
    };
    const parsed = parseOrReport(argv, output);
    if (parsed === null)
        return 2;
    try {
        const informational = runInformational(parsed, output);
        if (informational !== null)
            return informational;
        return await execute(parsed, output);
    }
    catch (error) {
        output.stderr(`mdtheme: ${error instanceof Error ? error.message : String(error)}`);
        return 2;
    }
}
if (process.argv[1] !== undefined &&
    import.meta.filename === realpathSync(resolve(process.argv[1]))) {
    process.exitCode = await runCli();
}
//# sourceMappingURL=cli.js.map