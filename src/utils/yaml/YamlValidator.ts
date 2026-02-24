/**
 * Scenario validation logic - converts raw YAML objects to typed OrchestratorScenario
 */

import * as yaml from 'js-yaml';
import fs from 'fs/promises';
import { OrchestratorScenario, TestStep, VerificationStep, Priority, TestInterface } from '../../models/TestModels';
import { YamlParserConfig, RawScenario, ValidationError } from './types';

/**
 * Validates raw YAML data and converts it to OrchestratorScenario instances.
 */
export class YamlValidator {
  constructor(private config: YamlParserConfig) {}

  /**
   * Validate and convert a raw scenario object.
   *
   * @throws ValidationError when required fields are missing or invalid in strict mode.
   */
  validateAndConvert(raw: RawScenario, context: string): OrchestratorScenario {
    const errors: string[] = [];

    if (!raw.id) errors.push('id is required');
    if (!raw.name) errors.push('name is required');
    if (!raw.description) errors.push('description is required');

    const priority = this.validatePriority(raw.priority);
    if (!priority && this.config.strictValidation) {
      errors.push(`invalid priority: ${raw.priority}`);
    }

    const testInterface = this.validateInterface(raw.interface);
    if (!testInterface && this.config.strictValidation) {
      errors.push(`invalid interface: ${raw.interface}`);
    }

    const steps = this.validateSteps(raw.steps || []);
    const verifications = this.validateVerifications(raw.verifications || []);

    if (errors.length > 0) {
      throw new ValidationError(`Validation errors in ${context}: ${errors.join(', ')}`);
    }

    return {
      id: raw.id!,
      name: raw.name!,
      description: raw.description!,
      priority: priority || Priority.MEDIUM,
      interface: testInterface || TestInterface.CLI,
      prerequisites: raw.prerequisites || [],
      steps,
      verifications,
      expectedOutcome: raw.expectedOutcome || '',
      estimatedDuration: raw.estimatedDuration || 60,
      tags: raw.tags || [],
      enabled: raw.enabled !== false,
      ...(raw.environment !== undefined ? { environment: raw.environment } : {}),
      ...(raw.cleanup ? { cleanup: this.validateSteps(raw.cleanup) } : {}),
    };
  }

  /**
   * Light structural validation of a YAML file without full scenario parsing.
   */
  async validateFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content);

      if (!parsed) {
        errors.push('Empty or invalid YAML file');
        return { valid: false, errors };
      }

      if (typeof parsed !== 'object') {
        errors.push('YAML must contain an object or array');
      }

      return { valid: errors.length === 0, errors };
    } catch (error: unknown) {
      errors.push(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, errors };
    }
  }

  private validatePriority(priority?: string): Priority | null {
    if (!priority) return null;
    const upper = priority.toUpperCase();
    return Object.values(Priority).includes(upper as Priority) ? upper as Priority : null;
  }

  private validateInterface(iface?: string): TestInterface | null {
    if (!iface) return null;
    const upper = iface.toUpperCase();
    return Object.values(TestInterface).includes(upper as TestInterface) ? upper as TestInterface : null;
  }

  private validateSteps(rawSteps: unknown[]): TestStep[] {
    return rawSteps.map((step: unknown, index: number) => {
      const s = step as Record<string, unknown>;
      if (typeof s !== 'object' || !s['action'] || !s['target']) {
        throw new ValidationError(`Invalid step at index ${index}: action and target are required`);
      }

      return {
        action: s['action'] as string,
        target: s['target'] as string,
        ...(s['value'] !== undefined ? { value: s['value'] as string } : {}),
        ...(s['waitFor'] !== undefined ? { waitFor: s['waitFor'] as string } : {}),
        ...(s['timeout'] !== undefined ? { timeout: s['timeout'] as number } : {}),
        ...(s['description'] !== undefined ? { description: s['description'] as string } : {}),
        ...(s['expected'] !== undefined ? { expected: s['expected'] as string } : {}),
      };
    });
  }

  private validateVerifications(rawVerifications: unknown[]): VerificationStep[] {
    return rawVerifications.map((verification: unknown, index: number) => {
      const v = verification as Record<string, unknown>;
      if (
        typeof v !== 'object' ||
        !v['type'] ||
        !v['target'] ||
        !v['expected'] ||
        !v['operator']
      ) {
        throw new ValidationError(
          `Invalid verification at index ${index}: type, target, expected, and operator are required`
        );
      }

      return {
        type: v['type'] as string,
        target: v['target'] as string,
        expected: v['expected'] as string,
        operator: v['operator'] as string,
        ...(v['description'] !== undefined ? { description: v['description'] as string } : {}),
      };
    });
  }
}
