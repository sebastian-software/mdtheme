type Manifest = Record<string, unknown>;
/** Normalize a manifest repository, falling back to a bounded local Git query. */
export declare function discoverRepository(root: string, npm: Manifest | undefined, cargo: Manifest | undefined): string | undefined;
/** Find the preferred CI workflow, leaving ambiguous custom workflow sets unset. */
export declare function discoverWorkflow(root: string): string | undefined;
export {};
//# sourceMappingURL=project-repository.d.ts.map