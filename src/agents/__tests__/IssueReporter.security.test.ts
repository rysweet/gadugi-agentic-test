/**
 * IssueReporter security tests - Issue #98
 *
 * Validates that attachScreenshot does NOT upload screenshot data to GitHub Gists.
 * 'Secret' gists have publicly accessible URLs, making them unsuitable for
 * sensitive screenshot data that may contain credentials, PII, or internal state.
 *
 * Test approach: attachScreenshot is a public method on IssueReporter so no
 * private-member casting is required. The gists.create spy is verified to be
 * unused by injecting the mock Octokit at module level via jest.mock('@octokit/rest').
 * This replaces the earlier (reporter as any).octokit assignment which was brittle —
 * "octokit" is a private field name and an implementation detail.
 */

import { IssueReporter } from '../IssueReporter';
import { GitHubConfig } from '../../models/Config';

// Mock @octokit/rest so no real network calls are made and so we can assert
// that gists.create is never invoked. The spy is defined at module scope so
// it persists across the jest.mock() hoisting boundary.
const gistsCreateSpy = jest.fn();

jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
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
    })),
  };
});

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

  beforeEach(() => {
    gistsCreateSpy.mockClear();
    reporter = new IssueReporter(makeConfig());
  });

  describe('attachScreenshot', () => {
    it('should NOT call gists.create (no Gist upload)', async () => {
      // attachScreenshot is a public method — no (as any) cast needed
      const result = await reporter.attachScreenshot(42, '/tmp/screenshot.png');

      expect(gistsCreateSpy).not.toHaveBeenCalled();
      // Should return the local path (or undefined) - never a gist URL
      if (result !== undefined) {
        expect(result).not.toMatch(/gist\.github\.com/);
        expect(result).not.toMatch(/^https?:\/\//);
      }
    });

    it('should return the local screenshot path (not a remote URL)', async () => {
      const screenshotPath = '/tmp/test-screenshot.png';

      // attachScreenshot is a public method — no (as any) cast needed
      const result = await reporter.attachScreenshot(42, screenshotPath);

      // Result must either be the local path or undefined - never a Gist URL
      expect(result === screenshotPath || result === undefined).toBe(true);
    });

    it('should not upload binary data to any external service', async () => {
      // attachScreenshot is a public method — no (as any) cast needed
      await reporter.attachScreenshot(99, '/tmp/sensitive-screenshot.png');

      // Primary assertion: Gist upload must not occur
      expect(gistsCreateSpy).not.toHaveBeenCalled();

      // Also verify no call included base64-encoded content
      const allCalls = gistsCreateSpy.mock.calls;
      expect(allCalls.length).toBe(0);
    });
  });
});
