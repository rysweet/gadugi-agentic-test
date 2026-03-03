/**
 * Scenarios module - Test scenario management
 */
export declare class ScenarioLoader {
    static loadFromFile(filePath: string): Promise<ScenarioDefinition>;
    static loadFromDirectory(dirPath: string): Promise<ScenarioDefinition[]>;
    private static convertLegacyFormat;
    private static validateScenario;
}
export interface ScenarioDefinition {
    name: string;
    description?: string;
    version?: string;
    config?: ScenarioConfig;
    environment?: EnvironmentConfig;
    agents: AgentConfig[];
    steps: TestStep[];
    assertions: TestAssertion[];
    cleanup?: TestStep[];
    metadata?: ScenarioMetadata;
}
/** @deprecated Use ScenarioDefinition instead - renamed to resolve naming conflict with models/TestModels.TestScenario. Will be removed in v2.0. */
export type TestScenario = ScenarioDefinition;
export interface ScenarioConfig {
    timeout?: number;
    retries?: number;
    parallel?: boolean;
}
export interface EnvironmentConfig {
    requires?: string[];
    optional?: string[];
}
export interface AgentConfig {
    name: string;
    type: string;
    config?: Record<string, unknown>;
}
export interface TestStep {
    name: string;
    agent: string;
    action: string;
    params?: Record<string, unknown>;
    timeout?: number;
    wait_for?: WaitCondition;
    until?: UntilCondition;
}
export interface WaitCondition {
    selector?: string;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
    timeout?: number;
}
export interface UntilCondition {
    condition: 'contains' | 'equals' | 'matches';
    value: unknown;
    timeout?: number;
}
export interface TestAssertion {
    name: string;
    type: string;
    agent: string;
    params: Record<string, unknown>;
}
export interface ScenarioMetadata {
    tags?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    author?: string;
    created?: string;
    updated?: string;
}
//# sourceMappingURL=index.d.ts.map