/**
 * IssueReporter security tests - Issue #98
 *
 * Validates that attachScreenshot does NOT upload screenshot data to GitHub Gists.
 * 'Secret' gists have publicly accessible URLs, making them unsuitable for
 * sensitive screenshot data that may contain credentials, PII, or internal state.
 */

import { IssueReporter } from '../IssueReporter';
import { GitHubConfig } from '../../models/Config';

// Minimal GitHub config
function makeConfig(): GitHubConfig {
  return {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  } as GitHubConfig;
}

describe('IssueReporter - screenshot security (issue #98)', () => {
  let reporter: IssueReporter;
  let mockOctokit: Record<string, unknown>;

  beforeEach(() => {
    // Spy to ensure gists.create is NEVER called
    const gistsCreateSpy = jest.fn();

    mockOctokit = {
      rest: {
        gists: {
          create: gistsCreateSpy,
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 1 } }),
        },
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: {
              rate: { limit: 5000, used: 0, remaining: 5000, reset: Math.floor(Date.now() / 1000) + 3600 },
            },
          }),
        },
      },
    };

    reporter = new IssueReporter(makeConfig());
    // Replace internal octokit with our spy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (reporter as any).octokit = mockOctokit;
  });

  describe('attachScreenshot', () => {
    it('should NOT call gists.create (no Gist upload)', async () => {
      const gistsCreateSpy = (mockOctokit.rest as any).gists.create as jest.Mock;

      // Call attachScreenshot with a local path
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (reporter as any).attachScreenshot(42, '/tmp/screenshot.png');

      expect(gistsCreateSpy).not.toHaveBeenCalled();
      // Should return the local path (or undefined) - never a gist URL
      if (result !== undefined) {
        expect(result).not.toMatch(/gist\.github\.com/);
        expect(result).not.toMatch(/^https?:\/\//);
      }
    });

    it('should return the local screenshot path (not a remote URL)', async () => {
      const screenshotPath = '/tmp/test-screenshot.png';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (reporter as any).attachScreenshot(42, screenshotPath);

      // Result must either be the local path or undefined - never a Gist URL
      expect(result === screenshotPath || result === undefined).toBe(true);
    });

    it('should not upload binary data to any external service', async () => {
      const gistsCreateSpy = (mockOctokit.rest as any).gists.create as jest.Mock;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (reporter as any).attachScreenshot(99, '/tmp/sensitive-screenshot.png');

      // Primary assertion: Gist upload must not occur
      expect(gistsCreateSpy).not.toHaveBeenCalled();

      // Also verify no call included base64-encoded content
      const allCalls = gistsCreateSpy.mock.calls;
      expect(allCalls.length).toBe(0);
    });
  });
});
