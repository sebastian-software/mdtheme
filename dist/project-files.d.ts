export type Manifest = Record<string, unknown>;
export declare function isRecord(value: unknown): value is Manifest;
export declare function parseJson(path: string): Manifest;
export declare function parseTomlManifest(path: string): Manifest;
export declare function parseYamlFile(path: string): Manifest;
export declare function regularFile(path: string): boolean;
//# sourceMappingURL=project-files.d.ts.map