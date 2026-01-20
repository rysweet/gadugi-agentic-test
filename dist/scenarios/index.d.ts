/**
 * Scenarios module - Test scenario management
 */
export declare class ScenarioLoader {
    static loadFromFile(filePath: string): Promise<TestScenario>;
    static loadFromDirectory(dirPath: string): Promise<TestScenario[]>;
    private static validateScenario;
}
export interface TestScenario {
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
    config?: Record<string, any>;
}
export interface TestStep {
    name: string;
    agent: string;
    action: string;
    params?: Record<string, any>;
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
    value: any;
    timeout?: number;
}
export interface TestAssertion {
    name: string;
    type: string;
    agent: string;
    params: Record<string, any>;
}
export interface ScenarioMetadata {
    tags?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    author?: string;
    created?: string;
    updated?: string;
}
//# sourceMappingURL=index.d.ts.map