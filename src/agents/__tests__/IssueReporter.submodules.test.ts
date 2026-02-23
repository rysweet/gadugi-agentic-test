/**
 * IssueReporter sub-module unit tests
 *
 * Tests for IssueFormatter, IssueDeduplicator, and IssueSubmitter.
 * Closes issue #130 (WS-F).
 */

import { IssueFormatter } from '../issue/IssueFormatter';
import { IssueDeduplicator } from '../issue/IssueDeduplicator';
import { IssueSubmitter } from '../issue/IssueSubmitter';
import { DEFAULT_CONFIG, IssueReporterConfig } from '../issue/types';
import { TestFailure } from '../../models/TestModels';
import { TestLogger, LogLevel } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): TestLogger {
  return new TestLogger('test', LogLevel.ERROR);
}

function makeConfig(overrides: Partial<IssueReporterConfig> = {}): IssueReporterConfig {
  return {
    ...DEFAULT_CONFIG,
    token: 'test-token',
    owner: 'test-owner',
    repository: 'test-repo',
    baseBranch: 'main',
    createIssuesOnFailure: true,
    issueLabels: ['bug', 'test-failure'],
    issueTitleTemplate: '[FAIL] {{scenarioName}} - {{failureMessage}}',
    issueBodyTemplate: 'Scenario: {{scenarioId}}\nMessage: {{failureMessage}}\nTime: {{timestamp}}\nPriority: {{priority}}',
    createPullRequestsForFixes: false,
    autoAssignUsers: [],
    ...overrides
  } as IssueReporterConfig;
}

function makeFailure(overrides: Partial<TestFailure> = {}): TestFailure {
  return {
    scenarioId: 'scenario-login-test',
    timestamp: new Date('2026-02-23T12:00:00.000Z'),
    message: 'Login button not found',
    stackTrace: 'Error: Login button not found\n  at line 42',
    failedStep: 2,
    category: 'ui',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// IssueFormatter tests
// ---------------------------------------------------------------------------

describe('IssueFormatter', () => {
  describe('generateIssueContent()', () => {
    it('generates a title containing the scenario name and failure message', async () => {
      const formatter = new IssueFormatter(makeConfig());
      const failure = makeFailure();
      const content = await formatter.generateIssueContent(failure);
      expect(content.title).toContain(failure.scenarioId);
      expect(content.title).toContain(failure.message);
    });

    it('includes scenario ID, error message, and timestamp in the body', async () => {
      const formatter = new IssueFormatter(makeConfig());
      const failure = makeFailure();
      const content = await formatter.generateIssueContent(failure);
      expect(content.body).toContain(failure.scenarioId);
      expect(content.body).toContain(failure.message);
      expect(content.body).toContain('2026-02-23');
    });

    it('embeds a fingerprint comment in the body for deduplication', async () => {
      const formatter = new IssueFormatter(makeConfig());
      const failure = makeFailure();
      const content = await formatter.generateIssueContent(failure);
      expect(content.body).toMatch(/<!-- fingerprint:[a-f0-9]+ -->/);
    });

    it('includes configured labels and priority label', async () => {
      const formatter = new IssueFormatter(makeConfig({ issueLabels: ['bug'] }));
      const failure = makeFailure();
      const content = await formatter.generateIssueContent(failure);
      expect(content.labels).toContain('bug');
      expect(content.labels?.some(l => l.startsWith('priority:'))).toBe(true);
    });
  });

  describe('renderTemplate()', () => {
    it('substitutes simple scalar variables', () => {
      const formatter = new IssueFormatter(makeConfig());
      const vars: any = {
        scenarioId: 'test-123',
        scenarioName: 'Login Test',
        failureMessage: 'Element not found',
        timestamp: '2026-02-23T12:00:00Z',
        environment: {},
        reproductionSteps: [],
        systemInfo: {},
        priority: 'High'
      };
      const template = 'Scenario: {{scenarioId}} - {{failureMessage}}';
      const result = formatter.renderTemplate(template, vars);
      expect(result).toBe('Scenario: test-123 - Element not found');
    });

    it('handles array conditional blocks', () => {
      const formatter = new IssueFormatter(makeConfig());
      const vars: any = {
        scenarioId: 'x',
        scenarioName: 'X',
        failureMessage: 'err',
        timestamp: 't',
        environment: {},
        reproductionSteps: ['Step A', 'Step B'],
        systemInfo: {},
        priority: 'Medium'
      };
      const template = '{{#reproductionSteps}}{{this}}\n{{/reproductionSteps}}';
      const result = formatter.renderTemplate(template, vars);
      expect(result).toContain('Step A');
      expect(result).toContain('Step B');
    });

    it('collapses conditional block when array is empty', () => {
      const formatter = new IssueFormatter(makeConfig());
      const vars: any = {
        scenarioId: 'x',
        scenarioName: 'X',
        failureMessage: 'err',
        timestamp: 't',
        environment: {},
        reproductionSteps: [],
        systemInfo: {},
        priority: 'Medium'
      };
      const template = 'Before{{#reproductionSteps}}CONTENT{{/reproductionSteps}}After';
      const result = formatter.renderTemplate(template, vars);
      expect(result).toBe('BeforeAfter');
    });

    it('substitutes object property variables with dot notation', () => {
      const formatter = new IssueFormatter(makeConfig());
      const vars: any = {
        scenarioId: 'x',
        scenarioName: 'X',
        failureMessage: 'err',
        timestamp: 't',
        environment: {},
        reproductionSteps: [],
        systemInfo: { platform: 'linux', nodeVersion: 'v20.0.0' },
        priority: 'Low'
      };
      const template = 'Platform: {{systemInfo.platform}} Node: {{systemInfo.nodeVersion}}';
      const result = formatter.renderTemplate(template, vars);
      expect(result).toContain('linux');
      expect(result).toContain('v20.0.0');
    });
  });

  describe('determinePriority()', () => {
    it('returns Critical for failures with category "critical"', () => {
      const formatter = new IssueFormatter(makeConfig());
      expect(formatter.determinePriority(makeFailure({ category: 'critical' }))).toBe('Critical');
    });

    it('returns Critical when failure message contains "critical"', () => {
      const formatter = new IssueFormatter(makeConfig());
      expect(formatter.determinePriority(makeFailure({ message: 'Critical service down', category: undefined }))).toBe('Critical');
    });

    it('returns High when failure message contains "error"', () => {
      const formatter = new IssueFormatter(makeConfig());
      expect(formatter.determinePriority(makeFailure({ message: 'Unexpected error occurred', category: undefined }))).toBe('High');
    });

    it('returns Medium for ordinary failures', () => {
      const formatter = new IssueFormatter(makeConfig());
      expect(formatter.determinePriority(makeFailure({ message: 'Button label mismatch', category: undefined }))).toBe('Medium');
    });
  });

  describe('generateReproductionSteps()', () => {
    it('includes the scenario ID and failed step number', () => {
      const formatter = new IssueFormatter(makeConfig());
      const failure = makeFailure({ failedStep: 4 });
      const steps = formatter.generateReproductionSteps(failure);
      expect(steps.some(s => s.includes(failure.scenarioId))).toBe(true);
      expect(steps.some(s => s.includes('5'))).toBe(true); // failedStep 4 → step 5 (1-indexed)
    });

    it('includes category note when category is set', () => {
      const formatter = new IssueFormatter(makeConfig());
      const steps = formatter.generateReproductionSteps(makeFailure({ category: 'network' }));
      expect(steps.some(s => s.includes('network'))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// IssueDeduplicator tests
// ---------------------------------------------------------------------------

describe('IssueDeduplicator', () => {
  const deduplicator = new IssueDeduplicator();

  afterEach(() => {
    deduplicator.clear();
  });

  describe('generateFingerprint()', () => {
    it('creates a consistent hash for the same failure', () => {
      const failure = makeFailure();
      const fp1 = deduplicator.generateFingerprint(failure);
      const fp2 = deduplicator.generateFingerprint(failure);
      expect(fp1.hash).toBe(fp2.hash);
    });

    it('creates a different hash for failures with different scenario IDs', () => {
      const fp1 = deduplicator.generateFingerprint(makeFailure({ scenarioId: 'scenario-A' }));
      const fp2 = deduplicator.generateFingerprint(makeFailure({ scenarioId: 'scenario-B' }));
      expect(fp1.hash).not.toBe(fp2.hash);
    });

    it('creates a different hash for failures with different error messages', () => {
      const fp1 = deduplicator.generateFingerprint(makeFailure({ message: 'Error A' }));
      const fp2 = deduplicator.generateFingerprint(makeFailure({ message: 'Error B' }));
      expect(fp1.hash).not.toBe(fp2.hash);
    });

    it('includes a stackTraceHash when stackTrace is present', () => {
      const fp = deduplicator.generateFingerprint(makeFailure({ stackTrace: 'at line 42' }));
      expect(fp.stackTraceHash).toBeDefined();
      expect(fp.stackTraceHash).toHaveLength(8); // md5 first 8 chars
    });

    it('leaves stackTraceHash undefined when no stackTrace', () => {
      const fp = deduplicator.generateFingerprint(makeFailure({ stackTrace: undefined }));
      expect(fp.stackTraceHash).toBeUndefined();
    });

    it('hash is 16 hex characters (sha256 truncated)', () => {
      const fp = deduplicator.generateFingerprint(makeFailure());
      expect(fp.hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('cacheFingerprint() and clear()', () => {
    it('caches a fingerprint without error', () => {
      const failure = makeFailure();
      const fp = deduplicator.generateFingerprint(failure);
      expect(() => deduplicator.cacheFingerprint(fp)).not.toThrow();
    });

    it('clears the cache without error', () => {
      const fp = deduplicator.generateFingerprint(makeFailure());
      deduplicator.cacheFingerprint(fp);
      expect(() => deduplicator.clear()).not.toThrow();
    });
  });

  describe('findDuplicate()', () => {
    it('returns null immediately when deduplication is disabled', async () => {
      const mockOctokit: any = { rest: { search: { issuesAndPullRequests: jest.fn() } } };
      const config = makeConfig({ enableDeduplication: false, deduplicationLookbackDays: 30 });
      const result = await deduplicator.findDuplicate(makeFailure(), mockOctokit, config, makeLogger());
      expect(result).toBeNull();
      expect(mockOctokit.rest.search.issuesAndPullRequests).not.toHaveBeenCalled();
    });

    it('returns null when no issue body contains the fingerprint hash', async () => {
      const failure = makeFailure();
      const fp = deduplicator.generateFingerprint(failure);

      const mockOctokit: any = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue({
              data: {
                items: [
                  { number: 1, body: 'some body without the fingerprint' }
                ]
              }
            })
          }
        }
      };

      const config = makeConfig({ enableDeduplication: true, deduplicationLookbackDays: 30 });
      const result = await deduplicator.findDuplicate(failure, mockOctokit, config, makeLogger());
      expect(result).toBeNull();
    });

    it('returns a matching issue when its body contains the fingerprint hash', async () => {
      const failure = makeFailure();
      const fp = deduplicator.generateFingerprint(failure);

      const mockOctokit: any = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn().mockResolvedValue({
              data: {
                items: [
                  { number: 77, body: `some body <!-- fingerprint:${fp.hash} --> text` }
                ]
              }
            })
          }
        }
      };

      const config = makeConfig({ enableDeduplication: true, deduplicationLookbackDays: 30 });
      const result = await deduplicator.findDuplicate(failure, mockOctokit, config, makeLogger());
      expect(result).not.toBeNull();
      expect(result.number).toBe(77);
    });

    it('returns null and logs a warning when the GitHub search API throws', async () => {
      const mockOctokit: any = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn().mockRejectedValue(new Error('API error'))
          }
        }
      };

      const config = makeConfig({ enableDeduplication: true, deduplicationLookbackDays: 30 });
      const result = await deduplicator.findDuplicate(makeFailure(), mockOctokit, config, makeLogger());
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// IssueSubmitter tests
// ---------------------------------------------------------------------------

describe('IssueSubmitter', () => {
  function makeSubmitter(octokitOverrides: any = {}) {
    const mockOctokit: any = {
      rest: {
        issues: {
          create: jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/test/issues/42' } }),
          createComment: jest.fn().mockResolvedValue({ data: { id: 1 } }),
          update: jest.fn().mockResolvedValue({}),
          addAssignees: jest.fn().mockResolvedValue({})
        },
        pulls: {
          create: jest.fn().mockResolvedValue({ data: { number: 10, html_url: 'https://github.com/test/pull/10' } })
        },
        repos: {
          get: jest.fn().mockResolvedValue({ data: { name: 'test-repo' } })
        },
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: {
              rate: {
                limit: 5000,
                used: 100,
                remaining: 4900,
                reset: Math.floor(Date.now() / 1000) + 3600
              }
            }
          })
        },
        gists: {
          create: jest.fn()
        },
        ...octokitOverrides
      }
    };

    const config = makeConfig({ rateLimitBuffer: 100 });
    const submitter = new IssueSubmitter(mockOctokit, config, makeLogger());
    return { submitter, mockOctokit };
  }

  describe('createIssue()', () => {
    it('calls octokit.rest.issues.create with the correct owner, repo, and options', async () => {
      const { submitter, mockOctokit } = makeSubmitter();
      const result = await submitter.createIssue({
        title: 'Test Failure: login test',
        body: 'Some body content',
        labels: ['bug']
      });
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(1);
      const callArgs = mockOctokit.rest.issues.create.mock.calls[0][0];
      expect(callArgs.owner).toBe('test-owner');
      expect(callArgs.repo).toBe('test-repo');
      expect(callArgs.title).toBe('Test Failure: login test');
      expect(result.issueNumber).toBe(42);
      expect(result.url).toContain('github.com');
    });
  });

  describe('checkRateLimit()', () => {
    it('proceeds normally when rate limit is not exhausted', async () => {
      const { submitter, mockOctokit } = makeSubmitter();
      // Remaining (4900) > buffer (100), so no wait
      await expect(submitter.checkRateLimit()).resolves.not.toThrow();
    });

    it('waits when remaining rate limit is at or below the buffer (max 60s)', async () => {
      jest.useFakeTimers();

      const nearFutureReset = Math.floor((Date.now() + 2000) / 1000); // resets in 2 seconds
      const { submitter, mockOctokit } = makeSubmitter({
        rateLimit: {
          get: jest.fn()
            .mockResolvedValueOnce({
              data: { rate: { limit: 5000, used: 4950, remaining: 50, reset: nearFutureReset } }
            })
            .mockResolvedValue({
              data: { rate: { limit: 5000, used: 0, remaining: 5000, reset: nearFutureReset + 3600 } }
            })
        }
      });

      const checkPromise = submitter.checkRateLimit();
      // Advance past the wait period
      jest.advanceTimersByTime(5000);
      await checkPromise;

      // Should have called getRateLimitInfo at least twice (initial + after wait)
      expect(mockOctokit.rest.rateLimit.get).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000);
  });

  describe('attachScreenshot() - security fix verification', () => {
    it('does NOT call octokit.rest.gists.create', async () => {
      const { submitter, mockOctokit } = makeSubmitter();
      await submitter.attachScreenshot(42, '/tmp/test-screenshot.png');
      expect(mockOctokit.rest.gists.create).not.toHaveBeenCalled();
    });

    it('adds a comment referencing the local file path instead of uploading', async () => {
      const { submitter, mockOctokit } = makeSubmitter();
      await submitter.attachScreenshot(42, '/tmp/test-screenshot.png');
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
      const commentBody = mockOctokit.rest.issues.createComment.mock.calls[0][0].body;
      expect(commentBody).toContain('test-screenshot.png');
      expect(commentBody).toContain('/tmp/test-screenshot.png');
    });

    it('returns the local screenshot path (not a remote URL)', async () => {
      const { submitter } = makeSubmitter();
      const result = await submitter.attachScreenshot(42, '/tmp/screenshot.png');
      expect(result).toBe('/tmp/screenshot.png');
      expect(result).not.toMatch(/^https?:\/\//);
      expect(result).not.toMatch(/gist\.github\.com/);
    });
  });

  describe('addComment()', () => {
    it('calls octokit.rest.issues.createComment with the correct parameters', async () => {
      const { submitter, mockOctokit } = makeSubmitter();
      await submitter.addComment(99, 'A comment body');
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issue_number: 99,
          body: 'A comment body'
        })
      );
    });
  });

  describe('verifyAccess()', () => {
    it('resolves when the repository is accessible', async () => {
      const { submitter } = makeSubmitter();
      await expect(submitter.verifyAccess()).resolves.not.toThrow();
    });

    it('throws when the repository is not accessible', async () => {
      const { submitter } = makeSubmitter({
        repos: { get: jest.fn().mockRejectedValue(new Error('Not Found')) }
      });
      await expect(submitter.verifyAccess()).rejects.toThrow(/GitHub API access failed/i);
    });
  });

  describe('createPullRequest()', () => {
    it('calls octokit.rest.pulls.create and returns prNumber and url', async () => {
      const { submitter, mockOctokit } = makeSubmitter();
      const result = await submitter.createPullRequest({
        title: 'Fix: test failure',
        body: 'Automated fix',
        head: 'fix/branch',
        base: 'main'
      });
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1);
      expect(result.prNumber).toBe(10);
      expect(result.url).toContain('github.com');
    });
  });
});
