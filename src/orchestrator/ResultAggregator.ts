/**
 * ResultAggregator
 *
 * Collects test results and failures, drives analysis (PriorityAgent)
 * and reporting (IssueReporter).
 */

import { TestResult, TestFailure, TestStatus } from '../models/TestModels';
import { PriorityAgent } from '../agents/PriorityAgent';
import { IssueReporter } from '../agents/IssueReporter';
import { logger } from '../utils/logger';

export class ResultAggregator {
  private results: TestResult[] = [];
  private failures: TestFailure[] = [];
  private priorityAgent: PriorityAgent;
  private issueReporter: IssueReporter;
  private createIssues: boolean;

  constructor(options: {
    priorityAgent: PriorityAgent;
    issueReporter: IssueReporter;
    createIssues: boolean;
  }) {
    this.priorityAgent = options.priorityAgent;
    this.issueReporter = options.issueReporter;
    this.createIssues = options.createIssues;
  }

  /**
   * Record a test result. Extracts failure metadata when applicable.
   */
  record(result: TestResult): void {
    this.results.push(result);

    if (result.status === TestStatus.FAILED && result.error) {
      this.failures.push({
        scenarioId: result.scenarioId,
        timestamp: new Date(),
        message: result.error,
        stackTrace: result.stackTrace,
        category: 'execution',
        logs: result.logs
      });
    }
  }

  /**
   * Record a bare failure (scenario never produced a TestResult)
   */
  recordFailure(scenarioId: string, message: string): void {
    this.failures.push({
      scenarioId,
      timestamp: new Date(),
      message,
      category: 'execution'
    });
  }

  /**
   * Run PriorityAgent analysis over accumulated failures
   */
  async analyze(): Promise<void> {
    if (this.failures.length === 0) {
      logger.info('No failures to analyze');
      return;
    }

    logger.info(`Analyzing ${this.failures.length} failures`);

    for (const failure of this.failures) {
      const priority = await this.priorityAgent.analyzePriority(failure);
      logger.debug(`Failure ${failure.scenarioId} priority: ${priority.priority} (score: ${priority.impactScore})`);
    }

    const report = await this.priorityAgent.generatePriorityReport(this.failures, this.results);
    logger.info('Priority summary:', {
      critical: report.summary.criticalCount,
      high: report.summary.highCount,
      medium: report.summary.mediumCount,
      low: report.summary.lowCount,
      average: report.summary.averageImpactScore.toFixed(2)
    });
  }

  /**
   * Report failures to GitHub via IssueReporter
   */
  async report(): Promise<void> {
    if (this.failures.length === 0) {
      logger.info('No failures to report');
      return;
    }

    if (!this.createIssues) {
      logger.info('Issue creation disabled');
      return;
    }

    logger.info(`Reporting ${this.failures.length} failures to GitHub`);
    await this.issueReporter.initialize();

    try {
      logger.warn('Issue reporting functionality needs implementation');
    } finally {
      await this.issueReporter.cleanup();
    }
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getFailures(): TestFailure[] {
    return this.failures;
  }
}
