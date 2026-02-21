/**
 * SessionManager
 *
 * Creates, tracks, and completes test sessions. Handles persistence of session data.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { TestSession, TestResult, TestStatus } from '../models/TestModels';
import { TestConfig } from '../models/Config';
import { logger } from '../utils/logger';

export class SessionManager {
  private config: TestConfig;
  private session: TestSession | null = null;
  private results: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  /**
   * Create and activate a new test session
   */
  create(): TestSession {
    this.results = [];
    this.session = {
      id: uuidv4(),
      startTime: new Date(),
      endTime: undefined,
      status: TestStatus.RUNNING,
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      config: this.config
    };
    return this.session;
  }

  /**
   * Record a result into the active session
   */
  addResult(result: TestResult): void {
    this.results.push(result);
    this.session?.results.push(result);
  }

  /**
   * Finalize the session, computing metrics and persisting to disk
   */
  async complete(overallStatus?: TestStatus): Promise<TestSession> {
    if (!this.session) throw new Error('No active session');

    this.session.endTime = new Date();
    this.session.status = overallStatus ?? this.deriveStatus();
    this.updateSummary();

    await this.persist();
    return this.session;
  }

  getSession(): TestSession | null {
    return this.session;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  private deriveStatus(): TestStatus {
    if (this.results.every(r => r.status === TestStatus.PASSED)) return TestStatus.PASSED;
    if (this.results.some(r => r.status === TestStatus.FAILED)) return TestStatus.FAILED;
    if (this.results.some(r => r.status === TestStatus.ERROR)) return TestStatus.ERROR;
    return TestStatus.SKIPPED;
  }

  private updateSummary(): void {
    if (!this.session) return;
    this.session.summary.total = this.results.length;
    this.session.summary.passed = this.results.filter(r => r.status === TestStatus.PASSED).length;
    this.session.summary.failed = this.results.filter(r => r.status === TestStatus.FAILED).length;
    this.session.summary.skipped = this.results.filter(r => r.status === TestStatus.SKIPPED).length;
  }

  private async persist(): Promise<void> {
    if (!this.session) return;

    const outputDir = path.join(process.cwd(), 'outputs', 'sessions');
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = this.session.startTime.toISOString().replace(/[:.]/g, '-');
    const filename = `session_${this.session.id}_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify({ ...this.session, results: this.results }, null, 2));
    logger.info(`Session results saved to ${filepath}`);
  }
}
