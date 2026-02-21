/**
 * WebSocket sub-module: WebSocketStepExecutor
 *
 * Translates TestStep actions into WebSocket operations.
 * Encapsulates the executeStep switch and associated parsing helpers.
 */

import { TestStep, TestStatus, StepResult } from '../../models/TestModels';
import { delay } from '../../utils/async';
import { ConnectionState } from './types';
import { WebSocketConnection } from './WebSocketConnection';
import { WebSocketMessageHandler } from './WebSocketMessageHandler';
import { WebSocketEventRecorder } from './WebSocketEventRecorder';

export class WebSocketStepExecutor {
  constructor(
    private readonly connection: WebSocketConnection,
    private readonly messageHandler: WebSocketMessageHandler,
    private readonly eventRecorder: WebSocketEventRecorder,
    private readonly connectFn: (url?: string, options?: any) => Promise<void>,
    private readonly disconnectFn: () => Promise<void>
  ) {}

  async executeStep(step: TestStep, stepIndex: number): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const result = await this.dispatch(step);
      return {
        stepIndex,
        status: TestStatus.PASSED,
        duration: Date.now() - startTime,
        actualResult: typeof result === 'string' ? result : JSON.stringify(result)
      };
    } catch (error: any) {
      return {
        stepIndex,
        status: TestStatus.FAILED,
        duration: Date.now() - startTime,
        error: error?.message
      };
    }
  }

  private async dispatch(step: TestStep): Promise<any> {
    switch (step.action.toLowerCase()) {
      case 'connect':
        await this.connectFn(step.target || undefined);
        return true;

      case 'disconnect':
        await this.disconnectFn();
        return true;

      case 'send':
      case 'emit':
        return this.parseSendStep(step);

      case 'wait_for_message':
      case 'wait_for_event':
        return this.parseWaitStep(step);

      case 'validate_message': {
        const expected = step.expected || step.value || '';
        return this.messageHandler.validateMessage(expected);
      }

      case 'validate_connection':
        return (
          this.connection.isConnected() &&
          this.connection.getConnectionState() === ConnectionState.CONNECTED
        );

      case 'add_listener':
        this.messageHandler.addEventListener(step.target, step.value);
        return true;

      case 'remove_listener':
        this.messageHandler.removeEventListener(step.target);
        return true;

      case 'ping':
        return this.messageHandler.pingServer();

      case 'wait': {
        const waitTime = parseInt(step.value || '1000');
        await delay(waitTime);
        return true;
      }

      case 'set_auth':
        this.eventRecorder.setAuthentication(step.target, step.value);
        return true;

      default:
        throw new Error(`Unsupported WebSocket action: ${step.action}`);
    }
  }

  private async parseSendStep(step: TestStep) {
    let data: any;
    let ack = false;

    if (step.value) {
      try {
        const parsed = JSON.parse(step.value);
        data = parsed.data || parsed;
        ack = parsed.ack || false;
      } catch {
        data = step.value;
      }
    }

    return this.messageHandler.sendMessage(step.target, data, ack);
  }

  private async parseWaitStep(step: TestStep) {
    const timeout = step.timeout || 10000;
    let filter: ((data: any) => boolean) | undefined;

    if (step.value) {
      try {
        const filterConfig = JSON.parse(step.value);
        if (filterConfig.filter) {
          filter = (data: any) => JSON.stringify(data).includes(filterConfig.filter);
        }
      } catch {
        filter = (data: any) => JSON.stringify(data).includes(step.value!);
      }
    }

    return this.messageHandler.waitForMessage(step.target, timeout, filter);
  }
}
