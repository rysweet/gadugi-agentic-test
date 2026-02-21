/**
 * APIAuthHandler - Authentication configuration and header injection
 *
 * Supports bearer token, API key, and HTTP Basic authentication.
 * Applies auth headers to an Axios instance's defaults.
 */

import { AxiosInstance } from 'axios';
import { TestLogger } from '../../utils/logger';
import { AuthConfig } from './types';

export class APIAuthHandler {
  private logger: TestLogger;
  private axiosInstance: AxiosInstance;

  constructor(axiosInstance: AxiosInstance, logger: TestLogger) {
    this.axiosInstance = axiosInstance;
    this.logger = logger;
  }

  /**
   * Apply authentication to the Axios instance based on config
   */
  applyAuth(auth: AuthConfig): void {
    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${auth.token}`;
        }
        break;
      case 'apikey':
        if (auth.apiKey) {
          const header = auth.apiKeyHeader || 'X-API-Key';
          this.axiosInstance.defaults.headers.common[header] = auth.apiKey;
        }
        break;
      case 'basic':
        if (auth.username !== undefined && auth.password !== undefined) {
          const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${encoded}`;
        }
        break;
      case 'custom':
        if (auth.customHeaders) {
          for (const [key, value] of Object.entries(auth.customHeaders)) {
            this.axiosInstance.defaults.headers.common[key] = value;
          }
        }
        break;
    }
  }

  /**
   * Set authentication dynamically via type string and optional value
   * Returns the resulting AuthConfig for storage in the agent config.
   */
  setAuthentication(type: string, value?: string): AuthConfig {
    switch (type.toLowerCase()) {
      case 'bearer': {
        const auth: AuthConfig = { type: 'bearer', token: value };
        this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${value}`;
        this.logger.debug(`Authentication configured: bearer`);
        return auth;
      }
      case 'apikey': {
        const [header, key] = (value || '').split(':');
        const auth: AuthConfig = {
          type: 'apikey',
          apiKey: key,
          apiKeyHeader: header || 'X-API-Key'
        };
        this.axiosInstance.defaults.headers.common[header || 'X-API-Key'] = key;
        this.logger.debug(`Authentication configured: apikey`);
        return auth;
      }
      case 'basic': {
        const [username, password] = (value || '').split(':');
        const auth: AuthConfig = { type: 'basic', username, password };
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${encoded}`;
        this.logger.debug(`Authentication configured: basic`);
        return auth;
      }
      default:
        throw new Error(`Unsupported authentication type: ${type}`);
    }
  }
}
