"use strict";
/**
 * GitHub Issue Reporter Agent (facade)
 *
 * Thin coordinator that delegates to:
 *   - IssueFormatter  – title/body template rendering
 *   - IssueDeduplicator – fingerprint-based duplicate detection
 *   - IssueSubmitter  – all GitHub API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueReporter = exports.defaultIssueReporterConfig = void 0;
exports.createIssueReporter = createIssueReporter;
const rest_1 = require("@octokit/rest");
const logger_1 = require("../utils/logger");
const index_1 = require("./index");
const types_1 = require("./issue/types");
const IssueFormatter_1 = require("./issue/IssueFormatter");
const IssueDeduplicator_1 = require("./issue/IssueDeduplicator");
const IssueSubmitter_1 = require("./issue/IssueSubmitter");
var types_2 = require("./issue/types");
Object.defineProperty(exports, "defaultIssueReporterConfig", { enumerable: true, get: function () { return types_2.DEFAULT_CONFIG; } });
/**
 * GitHub Issue Reporter Agent
 *
 * Coordinates issue creation, deduplication, and GitHub API submission
 * for test failure reporting.
 *
 * Implements IPipelineAgent because it reports on failures rather than
 * executing test scenarios. The primary API is createIssue(), updateIssue(),
 * and createPullRequest().
 *
 * Also implements IAgent for backward compatibility.
 */
class IssueReporter {
    constructor(config) {
        this.name = 'IssueReporter';
        this.type = index_1.AgentType.GITHUB;
        /** @inheritdoc IPipelineAgent */
        this.isPipelineAgent = true;
        this.config = { ...types_1.DEFAULT_CONFIG, ...config };
        this.log = logger_1.logger.child({ component: 'IssueReporter' });
        this.octokit = new rest_1.Octokit({
            auth: this.config.token,
            ...(this.config.baseUrl !== undefined ? { baseUrl: this.config.baseUrl } : {}),
            request: { ...(this.config.timeout !== undefined ? { timeout: this.config.timeout } : {}) }
        });
        this.formatter = new IssueFormatter_1.IssueFormatter(this.config);
        this.deduplicator = new IssueDeduplicator_1.IssueDeduplicator();
        this.submitter = new IssueSubmitter_1.IssueSubmitter(this.octokit, this.config, this.log);
        this.log.info('IssueReporter initialized', {
            owner: this.config.owner,
            repository: this.config.repository,
            baseUrl: this.config.baseUrl || 'https://api.github.com'
        });
    }
    /** Verify API access and refresh rate limits */
    async initialize() {
        try {
            await this.submitter.verifyAccess();
            this.log.info('IssueReporter initialized successfully');
        }
        catch (error) {
            this.log.error('Failed to initialize IssueReporter', { error: error.message });
            throw error;
        }
    }
    /** Release cached state */
    async cleanup() {
        this.deduplicator.clear();
        this.log.info('IssueReporter cleaned up');
    }
    /**
     * Execute issue reporting for a scenario (implements IAgent interface).
     *
     * Constructs a TestFailure from the scenario metadata and delegates to createIssue().
     * Returns null when createIssuesOnFailure is disabled in config.
     *
     * @deprecated Prefer calling createIssue() directly with a TestFailure.
     * This method exists only for IAgent backward compatibility.
     * IssueReporter is a pipeline agent — use isPipelineAgent() to detect it.
     */
    async execute(scenario) {
        if (!this.config.createIssuesOnFailure) {
            this.log.info('Issue creation disabled; skipping execute()', { scenarioId: scenario.id });
            return null;
        }
        this.log.info('Executing IssueReporter for scenario', { scenarioId: scenario.id });
        const failure = {
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
    async createIssue(failure) {
        this.log.info('Creating GitHub issue for test failure', {
            scenarioId: failure.scenarioId,
            category: failure.category
        });
        try {
            if (this.config.enableDeduplication) {
                const existing = await this.deduplicator.findDuplicate(failure, this.octokit, this.config, this.log);
                if (existing) {
                    this.log.info('Duplicate issue found, adding comment', { issueNumber: existing.number });
                    await this.submitter.addComment(existing.number, `## Additional Occurrence\n\n**Timestamp:** ${failure.timestamp.toISOString()}\n\nThis failure occurred again with the same fingerprint.`);
                    return { issueNumber: existing.number, url: existing.html_url };
                }
            }
            const issueOptions = await this.formatter.generateIssueContent(failure);
            const result = await this.submitter.createIssue(issueOptions);
            this.log.info('GitHub issue created successfully', result);
            const fingerprint = this.deduplicator.generateFingerprint(failure);
            this.deduplicator.cacheFingerprint(fingerprint);
            return result;
        }
        catch (error) {
            this.log.error('Failed to create GitHub issue', {
                error: error.message,
                scenarioId: failure.scenarioId
            });
            throw error;
        }
    }
    /** Update an existing issue */
    async updateIssue(issueNumber, update) {
        this.log.info('Updating GitHub issue', { issueNumber });
        try {
            await this.submitter.updateIssue(issueNumber, update);
            this.log.info('GitHub issue updated successfully', { issueNumber });
        }
        catch (error) {
            this.log.error('Failed to update GitHub issue', {
                error: error.message, issueNumber
            });
            throw error;
        }
    }
    /** Search for a duplicate issue for the given failure */
    async findDuplicates(failure) {
        return this.deduplicator.findDuplicate(failure, this.octokit, this.config, this.log);
    }
    /** Add a comment to an existing issue */
    async addComment(issueNumber, comment) {
        this.log.debug('Adding comment to issue', { issueNumber });
        try {
            await this.submitter.addComment(issueNumber, comment);
            this.log.debug('Comment added successfully', { issueNumber });
        }
        catch (error) {
            this.log.error('Failed to add comment', { error: error.message, issueNumber });
            throw error;
        }
    }
    /**
     * Record a screenshot reference for an issue.
     *
     * Security fix (issue #98): screenshots are never uploaded to external
     * services.  The local path is logged and returned so callers can include
     * it in reports without exposing credentials or sensitive data.
     */
    async attachScreenshot(issueNumber, screenshotPath) {
        this.log.debug('Recording screenshot for issue', { issueNumber, screenshotPath });
        return screenshotPath;
    }
    /** Create a pull request */
    async createPullRequest(options) {
        this.log.info('Creating pull request', { title: options.title, head: options.head, base: options.base });
        try {
            const result = await this.submitter.createPullRequest(options);
            this.log.info('Pull request created successfully', result);
            return result;
        }
        catch (error) {
            this.log.error('Failed to create pull request', {
                error: error.message, title: options.title
            });
            throw error;
        }
    }
    /** Link issues with a comment */
    async linkIssues(issueNumber, relatedIssueNumbers, linkType = 'relates') {
        const linkText = relatedIssueNumbers.map(n => `#${n}`).join(', ');
        await this.addComment(issueNumber, `## Related Issues\n\nThis issue ${linkType} ${linkText}`);
    }
    /** Assign users to an issue */
    async assignUsers(issueNumber, assignees) {
        this.log.debug('Assigning users to issue', { issueNumber, assignees });
        try {
            await this.submitter.addAssignees(issueNumber, assignees);
            this.log.debug('Users assigned successfully', { issueNumber, assignees });
        }
        catch (error) {
            this.log.error('Failed to assign users', {
                error: error.message, issueNumber, assignees
            });
            throw error;
        }
    }
    /** Set a milestone on an issue */
    async setMilestone(issueNumber, milestoneNumber) {
        this.log.debug('Setting milestone for issue', { issueNumber, milestoneNumber });
        await this.updateIssue(issueNumber, { milestone: milestoneNumber });
    }
    /** Fetch current GitHub rate limit info */
    async getRateLimitInfo() {
        return this.submitter.getRateLimitInfo();
    }
}
exports.IssueReporter = IssueReporter;
/** Factory function */
function createIssueReporter(config) {
    return new IssueReporter(config);
}
//# sourceMappingURL=IssueReporter.js.map