/**
 * IssueSubmitter - GitHub API submission: issues, comments, PRs, screenshots
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Octokit } from '@octokit/rest';
import { TestLogger } from '../../utils/logger';
import {
  IssueReporterConfig,
  RateLimitInfo,
  CreateIssueOptions,
  UpdateIssueOptions,
  CreatePullRequestOptions
} from './types';

/**
 * Handles all GitHub API calls: rate-limiting, issue CRUD, comments, PRs, and screenshots.
 */
export class IssueSubmitter {
  private octokit: Octokit;
  private config: IssueReporterConfig;
  private log: TestLogger;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(octokit: Octokit, config: IssueReporterConfig, log: TestLogger) {
    this.octokit = octokit;
    this.config = config;
    this.log = log;
  }

  /**
   * Verify that the configured repository is accessible
   */
  async verifyAccess(): Promise<void> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repository
      });
      this.log.info('GitHub API access verified');
    } catch (error) {
      this.log.error('GitHub API access verification failed', { error: (error as Error).message });
      throw new Error(`GitHub API access failed: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch current rate limit information from GitHub
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      const rl = response.data.rate;
      return {
        limit: rl.limit,
        used: rl.used,
        remaining: rl.remaining,
        reset: new Date(rl.reset * 1000)
      };
    } catch (error) {
      this.log.error('Failed to get rate limit info', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update cached rate limit and wait if the buffer is exhausted
   */
  async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) {
      await this.updateRateLimitInfo();
    }

    if (this.rateLimitInfo && this.rateLimitInfo.remaining <= this.config.rateLimitBuffer!) {
      const waitTime = this.rateLimitInfo.reset.getTime() - Date.now();
      if (waitTime > 0) {
        this.log.warn('Rate limit approaching, waiting for reset', {
          remaining: this.rateLimitInfo.remaining,
          resetTime: this.rateLimitInfo.reset.toISOString(),
          waitTimeMs: waitTime
        });
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
        await this.updateRateLimitInfo();
      }
    }
  }

  /**
   * Create a new GitHub issue
   */
  async createIssue(options: CreateIssueOptions): Promise<{ issueNumber: number; url: string }> {
    await this.checkRateLimit();

    const response = await this.octokit.rest.issues.create({
      owner: this.config.owner,
      repo: this.config.repository,
      ...options
    });

    return {
      issueNumber: response.data.number,
      url: response.data.html_url
    };
  }

  /**
   * Update an existing GitHub issue
   */
  async updateIssue(issueNumber: number, update: UpdateIssueOptions): Promise<void> {
    await this.checkRateLimit();

    await this.octokit.rest.issues.update({
      owner: this.config.owner,
      repo: this.config.repository,
      issue_number: issueNumber,
      ...update
    });
  }

  /**
   * Add a comment to an existing issue
   */
  async addComment(issueNumber: number, comment: string): Promise<void> {
    await this.checkRateLimit();

    await this.octokit.rest.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repository,
      issue_number: issueNumber,
      body: comment
    });
  }

  /**
   * Upload a screenshot to a Gist and attach a link comment to the issue
   */
  async attachScreenshot(issueNumber: number, screenshotPath: string): Promise<string> {
    const screenshotData = await fs.readFile(screenshotPath);
    const filename = path.basename(screenshotPath);

    const gistResponse = await this.octokit.rest.gists.create({
      description: `Screenshot for issue #${issueNumber}`,
      public: false,
      files: {
        [filename]: {
          content: screenshotData.toString('base64')
        }
      }
    });

    const screenshotUrl = `${gistResponse.data.html_url}#file-${filename.replace(/\./g, '-')}`;

    await this.addComment(issueNumber,
      `## Screenshot Added\n\n![${filename}](${screenshotUrl})\n\n*Screenshot uploaded at ${new Date().toISOString()}*`
    );

    return screenshotUrl;
  }

  /**
   * Add assignees to an issue
   */
  async addAssignees(issueNumber: number, assignees: string[]): Promise<void> {
    await this.checkRateLimit();

    await this.octokit.rest.issues.addAssignees({
      owner: this.config.owner,
      repo: this.config.repository,
      issue_number: issueNumber,
      assignees
    });
  }

  /**
   * Create a pull request
   */
  async createPullRequest(options: CreatePullRequestOptions): Promise<{ prNumber: number; url: string }> {
    await this.checkRateLimit();

    const response = await this.octokit.rest.pulls.create({
      owner: this.config.owner,
      repo: this.config.repository,
      ...options
    });

    return {
      prNumber: response.data.number,
      url: response.data.html_url
    };
  }

  /**
   * Refresh the cached rate limit info
   */
  private async updateRateLimitInfo(): Promise<void> {
    try {
      this.rateLimitInfo = await this.getRateLimitInfo();
      this.log.debug('Rate limit info updated', this.rateLimitInfo);
    } catch (error) {
      this.log.warn('Failed to update rate limit info', { error: (error as Error).message });
    }
  }
}
