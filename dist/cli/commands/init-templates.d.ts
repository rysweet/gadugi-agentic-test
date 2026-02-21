/**
 * Template generators for the `init` command.
 * Separated to keep init.ts under 300 LOC.
 */
export declare function getConfigTemplate(template: string): string;
export declare function getEnvTemplate(): string;
export declare function getScenarioTemplates(template: string): Record<string, string>;
export declare function getPackageJsonTemplate(projectName: string): string;
export declare function getReadmeTemplate(template: string): string;
export declare function getGitignoreTemplate(): string;
//# sourceMappingURL=init-templates.d.ts.map