#!/usr/bin/env node
export type CliIO = {
    readonly stdout?: (text: string) => void;
    readonly stderr?: (text: string) => void;
};
export type ParsedCli = {
    readonly operation: "check" | "help" | "version" | "write";
    readonly configPath: string | undefined;
};
export declare const HELP = "Usage: mdtheme <operation> [options]\n\nOperations:\n  --write             Render the source and atomically update README.md\n  --check             Render the source and check README.md for drift\n  --help              Show this help\n  --version           Show the installed version\n\nOptions:\n  --config PATH       Load a TypeScript or JavaScript config from PATH\n";
export declare function runCli(argv?: readonly string[], io?: CliIO): Promise<number>;
//# sourceMappingURL=cli.d.ts.map