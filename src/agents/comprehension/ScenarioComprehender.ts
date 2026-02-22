/**
 * ScenarioComprehender - Generates OrchestratorScenario objects from FeatureSpec
 */

import { OrchestratorScenario, TestStep, VerificationStep, Priority, TestInterface } from '../../models/TestModels';
import { FeatureSpec } from './types';

/**
 * Generates structured test scenarios (success, failure, edge-case) from a FeatureSpec.
 */
export class ScenarioComprehender {
  /**
   * Generate test scenarios from feature specification.
   * Returns 1 success scenario, up to 3 failure scenarios, up to 2 edge-case scenarios.
   */
  async generateTestScenarios(featureSpec: FeatureSpec): Promise<OrchestratorScenario[]> {
    const scenarios: OrchestratorScenario[] = [];
    let scenarioId = 1;

    scenarios.push(await this.generateSuccessScenario(featureSpec, scenarioId++));

    for (const failureMode of featureSpec.failureModes.slice(0, 3)) {
      scenarios.push(await this.generateFailureScenario(featureSpec, failureMode, scenarioId++));
    }

    for (const edgeCase of featureSpec.edgeCases.slice(0, 2)) {
      scenarios.push(await this.generateEdgeCaseScenario(featureSpec, edgeCase, scenarioId++));
    }

    return scenarios;
  }

  // ----- private scenario builders -----

  private async generateSuccessScenario(spec: FeatureSpec, id: number): Promise<OrchestratorScenario> {
    return {
      id: `${this.slug(spec.name)}_${id}`,
      name: `${spec.name} - Success Path`,
      description: `Verify ${spec.name} works correctly with valid inputs`,
      priority: Priority.HIGH,
      interface: this.determineInterface(spec.name),
      prerequisites: spec.dependencies,
      steps: this.generateSuccessSteps(spec),
      verifications: this.generateVerificationSteps(spec),
      expectedOutcome: spec.successCriteria.slice(0, 2).join('; ') || 'Feature executes successfully',
      estimatedDuration: 60,
      tags: ['success-path', 'smoke-test'],
      enabled: true,
      environment: {},
      cleanup: []
    };
  }

  private async generateFailureScenario(
    spec: FeatureSpec,
    failureMode: string,
    id: number
  ): Promise<OrchestratorScenario> {
    return {
      id: `${this.slug(spec.name)}_${id}`,
      name: `${spec.name} - Failure: ${failureMode.slice(0, 50)}`,
      description: `Verify ${spec.name} handles failure: ${failureMode}`,
      priority: Priority.MEDIUM,
      interface: this.determineInterface(spec.name),
      prerequisites: spec.dependencies,
      steps: this.generateFailureSteps(spec, failureMode),
      verifications: [{
        type: 'text',
        target: 'error_message',
        expected: failureMode,
        operator: 'contains',
        description: `Verify error message contains: ${failureMode}`
      }],
      expectedOutcome: `Feature handles error gracefully: ${failureMode}`,
      estimatedDuration: 45,
      tags: ['failure-mode', 'error-handling'],
      enabled: true,
      environment: {},
      cleanup: []
    };
  }

  private async generateEdgeCaseScenario(
    spec: FeatureSpec,
    edgeCase: string,
    id: number
  ): Promise<OrchestratorScenario> {
    return {
      id: `${this.slug(spec.name)}_${id}`,
      name: `${spec.name} - Edge Case: ${edgeCase.slice(0, 50)}`,
      description: `Verify ${spec.name} handles edge case: ${edgeCase}`,
      priority: Priority.LOW,
      interface: this.determineInterface(spec.name),
      prerequisites: spec.dependencies,
      steps: this.generateEdgeCaseSteps(spec, edgeCase),
      verifications: this.generateVerificationSteps(spec),
      expectedOutcome: `Feature handles edge case correctly: ${edgeCase}`,
      estimatedDuration: 30,
      tags: ['edge-case'],
      enabled: true,
      environment: {},
      cleanup: []
    };
  }

  // ----- step builders -----

  private generateSuccessSteps(spec: FeatureSpec): TestStep[] {
    const steps: TestStep[] = [];

    if (spec.dependencies.length > 0) {
      steps.push({
        action: 'execute',
        target: `setup ${spec.dependencies[0]}`,
        description: `Set up ${spec.dependencies[0]}`,
        timeout: 30000
      });
    }

    steps.push({
      action: 'execute',
      target: this.slug(spec.name),
      description: `Execute ${spec.name}`,
      timeout: 60000
    });

    steps.push({
      action: 'verify',
      target: 'output',
      expected: spec.successCriteria[0] || 'Success',
      description: 'Verify successful execution',
      timeout: 10000
    });

    return steps;
  }

  private generateFailureSteps(spec: FeatureSpec, failureMode: string): TestStep[] {
    return [
      {
        action: 'execute',
        target: this.slug(spec.name),
        value: 'invalid_input',
        description: `Execute ${spec.name} with invalid input`,
        timeout: 60000
      },
      {
        action: 'verify',
        target: 'error',
        expected: failureMode,
        description: `Verify error handling for: ${failureMode}`,
        timeout: 10000
      }
    ];
  }

  private generateEdgeCaseSteps(spec: FeatureSpec, edgeCase: string): TestStep[] {
    return [
      {
        action: 'execute',
        target: this.slug(spec.name),
        value: edgeCase,
        description: `Execute ${spec.name} with edge case: ${edgeCase}`,
        timeout: 60000
      },
      {
        action: 'verify',
        target: 'output',
        expected: 'handled',
        description: `Verify edge case handled: ${edgeCase}`,
        timeout: 10000
      }
    ];
  }

  private generateVerificationSteps(spec: FeatureSpec): VerificationStep[] {
    return spec.successCriteria.slice(0, 3).map(criterion => ({
      type: 'text',
      target: 'output',
      expected: criterion,
      operator: 'contains',
      description: `Verify: ${criterion}`
    }));
  }

  // ----- interface classification -----

  private determineInterface(featureName: string): TestInterface {
    const lower = featureName.toLowerCase();
    if (this.isCLIFeature(lower)) return TestInterface.CLI;
    if (this.isGUIFeature(lower)) return TestInterface.GUI;
    if (this.isAPIFeature(lower)) return TestInterface.API;
    return TestInterface.MIXED;
  }

  private isCLIFeature(name: string): boolean {
    return ['command', 'cli', 'atg', 'generate', 'build', 'doctor', 'agent-mode']
      .some(kw => name.includes(kw));
  }

  private isGUIFeature(name: string): boolean {
    return ['tab', 'button', 'page', 'ui', 'spa', 'electron', 'dialog', 'menu']
      .some(kw => name.includes(kw));
  }

  private isAPIFeature(name: string): boolean {
    return ['api', 'endpoint', 'rest', 'http', 'webhook']
      .some(kw => name.includes(kw));
  }

  /** Convert a feature name to a URL-safe slug */
  private slug(name: string): string {
    return name.replace(/\s+/g, '_').toLowerCase();
  }
}
