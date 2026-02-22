/**
 * GitHub Issue Reporter Agent (facade)
 *
 * Thin coordinator that delegates to:
 *   - IssueFormatter  – title/body template rendering
 *   - IssueDeduplicator – fingerprint-based duplicate detection
 *   - IssueSubmitter  – all GitHub API calls
 */

import { Octokit } from '@octokit/rest';
import { TestFailure, OrchestratorScenario } from '../models/TestModels';
import { TestLogger, logger } from '../utils/logger';
import { IAgent, AgentType } from './index';
import {
  IssueReporterConfig,
  RateLimitInfo,
  UpdateIssueOptions,
  CreatePullRequestOptions,
  DEFAULT_CONFIG
} from './issue/types';
import { IssueFormatter } from './issue/IssueFormatter';
import { IssueDeduplicator } from './issue/IssueDeduplicator';
import { IssueSubmitter } from './issue/IssueSubmitter';

// Re-export types so existing import sites continue to work
export type {
  IssueReporterConfig,
  RateLimitInfo,
  IssueFingerprint,
  CreateIssueOptions,
  UpdateIssueOptions,
  CreatePullRequestOptions,
  IssueTemplateVars,
  SystemInfo
} from './issue/types';

export { DEFAULT_CONFIG as defaultIssueReporterConfig } from './issue/types';

/**
 * GitHub Issue Reporter Agent
 *
 * Coordinates issue creation, deduplication, and GitHub API submission
 * for test failure reporting.
 */
export class IssueReporter implements IAgent<OrchestratorScenario, { issueNumber: number; url: string } | null> {
  public readonly name = 'IssueReporter';
  public readonly type = AgentType.GITHUB;

  private config: IssueReporterConfig;
  private log: TestLogger;
  private formatter: IssueFormatter;
  private deduplicator: IssueDeduplicator;
  private submitter: IssueSubmitter;
  private octokit: Octokit;

  constructor(config: IssueReporterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = logger.child({ component: 'IssueReporter' });

    this.octokit = new Octokit({
      auth: this.config.token,
      baseUrl: this.config.baseUrl,
      request: { timeout: this.config.timeout }
    });

    this.formatter = new IssueFormatter(this.config);
    this.deduplicator = new IssueDeduplicator();
    this.submitter = new IssueSubmitter(this.octokit, this.config, this.log);

    this.log.info('IssueReporter initialized', {
      owner: this.config.owner,
      repository: this.config.repository,
      baseUrl: this.config.baseUrl || 'https://api.github.com'
    });
  }

  /** Verify API access and refresh rate limits */
  async initialize(): Promise<void> {
    try {
      await this.submitter.verifyAccess();
      this.log.info('IssueReporter initialized successfully');
    } catch (error) {
      this.log.error('Failed to initialize IssueReporter', { error: (error as Error).message });
      throw error;
    }
  }

  /** Release cached state */
  async cleanup(): Promise<void> {
    this.deduplicator.clear();
    this.log.info('IssueReporter cleaned up');
  }

  /**
   * Execute issue reporting for a scenario (implements IAgent interface).
   *
   * Constructs a TestFailure from the scenario metadata and delegates to createIssue().
   * Returns null when createIssuesOnFailure is disabled in config.
   */
  async execute(scenario: OrchestratorScenario): Promise<{ issueNumber: number; url: string } | null> {
    if (!this.config.createIssuesOnFailure) {
      this.log.info('Issue creation disabled; skipping execute()', { scenarioId: scenario.id });
      return null;
    }

    this.log.info('Executing IssueReporter for scenario', { scenarioId: scenario.id });

    const failure: TestFailure = {
      scenarioId: scenario.id,
      timestamp: new Date(),
      message: `Test scenario "${scenario.name}" failed: ${scenario.expectedOutcome}`,
      category: scenario.interface?.toLowerCase(),
      logs: []
    };

    return this.createIssue(failure);
  }

  /**
   * Create or update a GitHub issue for a test failure.
   * When deduplication is enabled and a matching issue exists, appends a comment
   * instead of creating a new issue.
   */
  async createIssue(failure: TestFailure): Promise<{ issueNumber: number; url: string }> {
    this.log.info('Creating GitHub issue for test failure', {
      scenarioId: failure.scenarioId,
      category: failure.category
    });

    try {
      if (this.config.enableDeduplication) {
        const existing = await this.deduplicator.findDuplicate(
          failure, this.octokit, this.config, this.log
        );
        if (existing) {
          this.log.info('Duplicate issue found, adding comment', { issueNumber: existing.number });
          await this.submitter.addComment(existing.number,
            `## Additional Occurrence\n\n**Timestamp:** ${failure.timestamp.toISOString()}\n\nThis failure occurred again with the same fingerprint.`
          );
          return { issueNumber: existing.number, url: existing.html_url };
        }
      }

      const issueOptions = await this.formatter.generateIssueContent(failure);
      const result = await this.submitter.createIssue(issueOptions);

      this.log.info('GitHub issue created successfully', result);

      const fingerprint = this.deduplicator.generateFingerprint(failure);
      this.deduplicator.cacheFingerprint(fingerprint);

      return result;
    } catch (error) {
      this.log.error('Failed to create GitHub issue', {
        error: (error as Error).message,
        scenarioId: failure.scenarioId
      });
      throw error;
    }
  }

  /** Update an existing issue */
  async updateIssue(issueNumber: number, update: UpdateIssueOptions): Promise<void> {
    this.log.info('Updating GitHub issue', { issueNumber });
    try {
      await this.submitter.updateIssue(issueNumber, update);
      this.log.info('GitHub issue updated successfully', { issueNumber });
    } catch (error) {
      this.log.error('Failed to update GitHub issue', {
        error: (error as Error).message, issueNumber
      });
      throw error;
    }
  }

  /** Search for a duplicate issue for the given failure */
  async findDuplicates(failure: TestFailure): Promise<any | null> {
    return this.deduplicator.findDuplicate(failure, this.octokit, this.config, this.log);
  }

  /** Add a comment to an existing issue */
  async addComment(issueNumber: number, comment: string): Promise<void> {
    this.log.debug('Adding comment to issue', { issueNumber });
    try {
      await this.submitter.addComment(issueNumber, comment);
      this.log.debug('Comment added successfully', { issueNumber });
    } catch (error) {
      this.log.error('Failed to add comment', { error: (error as Error).message, issueNumber });
      throw error;
    }
  }

  /** Attach a screenshot to an issue via Gist */
  async attachScreenshot(issueNumber: number, screenshotPath: string): Promise<string> {
    this.log.debug('Attaching screenshot to issue', { issueNumber, screenshotPath });
    try {
      const url = await this.submitter.attachScreenshot(issueNumber, screenshotPath);
      this.log.debug('Screenshot attached successfully', { issueNumber, url });
      return url;
    } catch (error) {
      this.log.error('Failed to attach screenshot', {
        error: (error as Error).message, issueNumber, screenshotPath
      });
      throw error;
    }
  }

  /** Create a pull request */
  async createPullRequest(options: CreatePullRequestOptions): Promise<{ prNumber: number; url: string }> {
    this.log.info('Creating pull request', { title: options.title, head: options.head, base: options.base });
    try {
      const result = await this.submitter.createPullRequest(options);
      this.log.info('Pull request created successfully', result);
      return result;
    } catch (error) {
      this.log.error('Failed to create pull request', {
        error: (error as Error).message, title: options.title
      });
      throw error;
    }
  }

  /** Link issues with a comment */
  async linkIssues(
    issueNumber: number,
    relatedIssueNumbers: number[],
    linkType: 'blocks' | 'duplicates' | 'relates' = 'relates'
  ): Promise<void> {
    const linkText = relatedIssueNumbers.map(n => `#${n}`).join(', ');
    await this.addComment(issueNumber, `## Related Issues\n\nThis issue ${linkType} ${linkText}`);
  }

  /** Assign users to an issue */
  async assignUsers(issueNumber: number, assignees: string[]): Promise<void> {
    this.log.debug('Assigning users to issue', { issueNumber, assignees });
    try {
      await this.submitter.addAssignees(issueNumber, assignees);
      this.log.debug('Users assigned successfully', { issueNumber, assignees });
    } catch (error) {
      this.log.error('Failed to assign users', {
        error: (error as Error).message, issueNumber, assignees
      });
      throw error;
    }
  }

  /** Set a milestone on an issue */
  async setMilestone(issueNumber: number, milestoneNumber: number): Promise<void> {
    this.log.debug('Setting milestone for issue', { issueNumber, milestoneNumber });
    await this.updateIssue(issueNumber, { milestone: milestoneNumber });
  }

  /** Fetch current GitHub rate limit info */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    return this.submitter.getRateLimitInfo();
  }
}

/** Factory function */
export function createIssueReporter(config: IssueReporterConfig): IssueReporter {
  return new IssueReporter(config);
}
