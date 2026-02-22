/**
 * TUISessionManager - Terminal session lifecycle management
 *
 * Responsible for:
 * - Creating and tracking terminal sessions
 * - Setting up process event handlers (stdout, stderr, close, error)
 * - Graceful and forced session termination
 * - Killing all active sessions during cleanup
 */

import { spawn, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { TerminalSession, TerminalOutput, TUIAgentConfig } from './types';
import { stripAnsiCodes, parseColors } from './TUIOutputParser';
import { TestLogger } from '../../utils/logger';
import { delay } from '../../utils/async';

/**
 * Manages the lifecycle of TUI terminal sessions
 */
export class TUISessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly config: Required<TUIAgentConfig>;
  private readonly logger: TestLogger;
  private readonly emitter: EventEmitter;

  constructor(config: Required<TUIAgentConfig>, logger: TestLogger, emitter: EventEmitter) {
    this.config = config;
    this.logger = logger;
    this.emitter = emitter;
  }

  /**
   * Spawn a new TUI application session
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Spawn options override
   * @returns Session ID for the newly created session
   * @throws Error if process cannot be spawned
   */
  async createSession(
    command: string,
    args: string[] = [],
    options: Partial<SpawnOptions> = {}
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    const spawnOptions: SpawnOptions = {
      cwd: this.config.workingDirectory,
      env: {
        ...process.env,
        ...this.config.environment,
        ...options.env
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      ...options
    };

    this.logger.info(`Spawning TUI application: ${command}`, { args, sessionId });

    try {
      const proc = spawn(command, args, spawnOptions);

      if (!proc.pid) {
        throw new Error('Failed to spawn process');
      }

      const session: TerminalSession = {
        id: sessionId,
        pid: proc.pid,
        command,
        args,
        startTime: new Date(startTime),
        status: 'running',
        process: proc,
        size: this.config.terminalSize,
        outputBuffer: []
      };

      this.sessions.set(sessionId, session);
      this.setupSessionHandlers(session);

      if (proc.stdout && (proc.stdout as any).setRawMode) {
        (proc.stdout as any).setRawMode(true);
      }

      this.logger.info('TUI application spawned successfully', { sessionId, pid: proc.pid });
      this.emitter.emit('sessionStarted', session);

      return sessionId;
    } catch (error: any) {
      this.logger.error(`Failed to spawn TUI application: ${command}`, { error: error?.message });
      throw new Error(`Failed to spawn TUI application: ${error?.message}`);
    }
  }

  /**
   * Kill a specific session with SIGTERM then SIGKILL if needed
   *
   * @param sessionId - ID of the session to terminate
   * @throws Error if kill fails
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    try {
      this.logger.info(`Killing session: ${sessionId} (PID: ${session.pid})`);

      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');

        await delay(1000);

        if (!session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }

      session.status = 'killed';
      this.sessions.delete(sessionId);
      this.emitter.emit('sessionKilled', { sessionId });
    } catch (error: any) {
      this.logger.error(`Failed to kill session ${sessionId}`, { error: error?.message });
      throw new Error(`Failed to kill session ${sessionId}: ${error?.message}`);
    }
  }

  /**
   * Kill all active sessions (used during cleanup)
   */
  async cleanupSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());

    if (sessionIds.length === 0) return;

    this.logger.info(`Killing ${sessionIds.length} sessions`);

    const killPromises = sessionIds.map(sessionId =>
      this.destroySession(sessionId).catch(error =>
        this.logger.warn(`Failed to kill session ${sessionId}`, { error: error?.message })
      )
    );

    await Promise.all(killPromises);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions as a read-only map
   */
  getAllSessions(): ReadonlyMap<string, TerminalSession> {
    return this.sessions;
  }

  /**
   * Get summary info about all active sessions
   */
  getSessionInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    for (const [sessionId, session] of this.sessions.entries()) {
      info[sessionId] = {
        pid: session.pid,
        command: session.command,
        args: session.args,
        status: session.status,
        startTime: session.startTime,
        outputBufferSize: session.outputBuffer.length
      };
    }

    return info;
  }

  /**
   * Get the most recently created session ID
   *
   * @throws Error if no sessions are active
   */
  getMostRecentSessionId(): string {
    if (this.sessions.size === 0) {
      throw new Error('No active TUI sessions');
    }
    const sessions = Array.from(this.sessions.values());
    const sorted = sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return sorted[0].id;
  }

  // -- Private helpers --

  private generateSessionId(): string {
    return `tui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupSessionHandlers(session: TerminalSession): void {
    const { process: proc } = session;

    proc.stdout?.on('data', (data: Buffer) => {
      const raw = data.toString();
      const output: TerminalOutput = {
        type: 'stdout',
        raw,
        text: stripAnsiCodes(raw),
        colors: parseColors(raw),
        timestamp: new Date()
      };

      session.outputBuffer.push(output);

      if (this.config.logConfig.logOutputs) {
        this.logger.debug(`[STDOUT ${session.id}] ${output.text.trim()}`);
      }

      try { this.emitter.emit('output', { sessionId: session.id, output }); } catch { /* listener errors must not crash the session */ }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const raw = data.toString();
      const output: TerminalOutput = {
        type: 'stderr',
        raw,
        text: stripAnsiCodes(raw),
        colors: parseColors(raw),
        timestamp: new Date()
      };

      session.outputBuffer.push(output);

      if (this.config.logConfig.logOutputs) {
        this.logger.debug(`[STDERR ${session.id}] ${output.text.trim()}`);
      }

      try { this.emitter.emit('output', { sessionId: session.id, output }); } catch { /* listener errors must not crash the session */ }
    });

    proc.on('close', (code: number | null) => {
      session.status = code === 0 ? 'completed' : 'failed';
      this.logger.info(`Session ${session.id} closed with code ${code}`);
      this.emitter.emit('sessionClosed', { sessionId: session.id, exitCode: code });
    });

    proc.on('error', (error: Error) => {
      session.status = 'failed';
      this.logger.error(`Session ${session.id} error`, { error: error.message });
      this.emitter.emit('sessionError', { sessionId: session.id, error });
    });
  }
}
