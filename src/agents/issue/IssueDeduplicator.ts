/**
 * IssueDeduplicator - Detects duplicate GitHub issues via fingerprinting
 */

import * as crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import { TestFailure } from '../../models/TestModels';
import { TestLogger } from '../../utils/logger';
import { IssueReporterConfig, IssueFingerprint } from './types';

/**
 * Generates fingerprints for test failures and searches GitHub for matching issues.
 */
export class IssueDeduplicator {
  private fingerprintCache: Map<string, IssueFingerprint> = new Map();

  /**
   * Generate a stable fingerprint for a test failure
   */
  generateFingerprint(failure: TestFailure): IssueFingerprint {
    const fingerprintData = {
      scenarioId: failure.scenarioId,
      errorMessage: failure.message,
      category: failure.category || 'unknown'
    };

    let stackTraceHash: string | undefined;
    if (failure.stackTrace) {
      stackTraceHash = crypto
        .createHash('md5')
        .update(failure.stackTrace)
        .digest('hex')
        .substring(0, 8);
    }

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex')
      .substring(0, 16);

    return { ...fingerprintData, stackTraceHash, hash };
  }

  /**
   * Cache a fingerprint after successful issue creation
   */
  cacheFingerprint(fingerprint: IssueFingerprint): void {
    this.fingerprintCache.set(fingerprint.hash, fingerprint);
  }

  /**
   * Search GitHub for an existing open issue matching the failure fingerprint.
   * Returns the matching issue object or null if none found.
   */
  async findDuplicate(
    failure: TestFailure,
    octokit: Octokit,
    config: IssueReporterConfig,
    log: TestLogger
  ): Promise<any | null> {
    if (!config.enableDeduplication) {
      return null;
    }

    log.debug('Searching for duplicate issues', { scenarioId: failure.scenarioId });

    try {
      const fingerprint = this.generateFingerprint(failure);
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - config.deduplicationLookbackDays!);

      const searchQuery = [
        `repo:${config.owner}/${config.repository}`,
        'is:issue',
        `"${failure.scenarioId}"`,
        `created:>=${lookbackDate.toISOString().split('T')[0]}`
      ].join(' ');

      const searchResponse = await octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        sort: 'created',
        order: 'desc',
        per_page: 20
      });

      for (const issue of searchResponse.data.items) {
        if (issue.body && issue.body.includes(fingerprint.hash)) {
          log.debug('Found duplicate issue', {
            issueNumber: issue.number,
            fingerprint: fingerprint.hash
          });
          return issue;
        }
      }

      return null;
    } catch (error) {
      log.warn('Failed to search for duplicate issues', { error: (error as Error).message });
      return null;
    }
  }

  /** Remove all cached fingerprints */
  clear(): void {
    this.fingerprintCache.clear();
  }
}
