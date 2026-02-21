/**
 * APIResponseValidator - Response validation logic
 *
 * Validates API responses against expected status codes, headers,
 * JSON body content, and (stub) JSON schema.
 */

import { deepEqual } from '../../utils/comparison';
import { APIResponse, SchemaValidation } from './types';

export class APIResponseValidator {
  private validationConfig: SchemaValidation;

  constructor(validationConfig: SchemaValidation) {
    this.validationConfig = validationConfig;
  }

  /**
   * Validate a response body against an expected value (JSON or string match)
   */
  validateResponse(latestResponse: APIResponse | undefined, expected: string): boolean {
    if (!latestResponse) {
      throw new Error('No response available for validation');
    }
    try {
      const expectedData = JSON.parse(expected);
      return deepEqual(latestResponse.data, expectedData);
    } catch {
      return JSON.stringify(latestResponse.data).includes(expected);
    }
  }

  /**
   * Validate that the response status code matches the expected value
   */
  validateStatus(latestResponse: APIResponse | undefined, expectedStatus: number): boolean {
    if (!latestResponse) {
      throw new Error('No response available for status validation');
    }
    return latestResponse.status === expectedStatus;
  }

  /**
   * Validate that the response contains all expected headers with their values
   */
  validateHeaders(latestResponse: APIResponse | undefined, expected: string): boolean {
    if (!latestResponse) {
      throw new Error('No response available for header validation');
    }
    let expectedHeaders: Record<string, string>;
    try {
      expectedHeaders = JSON.parse(expected);
    } catch {
      throw new Error(`Invalid header validation format: ${expected}`);
    }
    for (const [key, value] of Object.entries(expectedHeaders)) {
      const actualValue = latestResponse.headers[key.toLowerCase()];
      if (actualValue !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate response against a JSON Schema (requires ajv to be installed)
   */
  validateResponseSchema(_schemaStr: string): boolean {
    if (!this.validationConfig.enabled) {
      throw new Error('Schema validation is disabled');
    }
    throw new Error(
      'Schema validation not implemented. Install ajv and implement, or remove validate_schema step action.'
    );
  }

  /**
   * Parse a headers value string: JSON object or single "key:value"
   */
  parseHeaders(value?: string): Record<string, string> | undefined {
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      const [key, val] = value.split(':');
      return key && val ? { [key.trim()]: val.trim() } : undefined;
    }
  }

  /**
   * Parse request body + optional headers from a step value string
   */
  parseRequestData(value?: string): { data?: any; headers?: Record<string, string> } {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (parsed.data && parsed.headers) return parsed;
      return { data: parsed };
    } catch {
      return { data: value };
    }
  }
}
