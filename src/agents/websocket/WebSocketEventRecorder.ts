/**
 * WebSocket sub-module: WebSocketEventRecorder
 *
 * Records connection and message events for later replay/inspection,
 * and manages authentication configuration mutations at runtime.
 */

import { TestLogger } from '../../utils/logger';
import { WebSocketAgentConfig } from './types';

/**
 * A single recorded event entry
 */
export interface RecordedEvent {
  type: 'connection' | 'message' | 'error';
  event: string;
  data?: unknown;
  timestamp: Date;
}

export class WebSocketEventRecorder {
  private recordedEvents: RecordedEvent[] = [];

  constructor(
    private config: Required<WebSocketAgentConfig>,
    private readonly logger: TestLogger
  ) {}

  /** Record an arbitrary event */
  record(type: RecordedEvent['type'], event: string, data?: unknown): void {
    this.recordedEvents.push({ type, event, data, timestamp: new Date() });
  }

  /** Return all recorded events */
  getRecordedEvents(): RecordedEvent[] {
    return [...this.recordedEvents];
  }

  /** Clear recorded events */
  clear(): void {
    this.recordedEvents = [];
  }

  /**
   * Apply WS_* environment variables to agent config
   */
  applyEnvironmentConfig(
    environment: Record<string, string>,
    setAuthentication: (type: string, value?: string) => void
  ): void {
    for (const [key, value] of Object.entries(environment)) {
      if (key.startsWith('WS_')) {
        switch (key) {
          case 'WS_SERVER_URL':
            this.config.serverURL = value;
            break;
          case 'WS_AUTH_TOKEN':
            setAuthentication('token', value);
            break;
          case 'WS_NAMESPACE':
            this.config.namespace = value;
            break;
        }
      }
    }
  }

  /**
   * Configure authentication on the agent config
   */
  setAuthentication(type: string, value?: string): void {
    switch (type.toLowerCase()) {
      case 'token':
        this.config.auth = { type: 'token', ...(value !== undefined ? { token: value } : {}) };
        break;

      case 'query': {
        const [param, tok] = (value || '').split(':');
        const queryToken = tok || value;
        this.config.auth = {
          type: 'query',
          queryParam: param || 'token',
          ...(queryToken !== undefined ? { token: queryToken } : {}),
        };
        break;
      }

      case 'header': {
        const [header, headerToken] = (value || '').split(':');
        const hToken = headerToken || value;
        this.config.auth = {
          type: 'header',
          headerName: header || 'Authorization',
          ...(hToken !== undefined ? { token: hToken } : {}),
        };
        break;
      }

      default:
        throw new Error(`Unsupported WebSocket authentication type: ${type}`);
    }

    this.logger.debug(`WebSocket authentication configured: ${type}`);
  }
}
