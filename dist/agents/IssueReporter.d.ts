/**
 * GitHub Issue Reporter Agent (facade)
 *
 * Thin coordinator that delegates to:
 *   - IssueFormatter  – title/body template rendering
 *   - IssueDeduplicator – fingerprint-based duplicate detection
 *   - IssueSubmitter  – all GitHub API calls
 */
import { TestFailure, OrchestratorScenario } from '../models/TestModels';
import { IAgent, IPipelineAgent, AgentType } from './index';
import { IssueReporterConfig, RateLimitInfo, UpdateIssueOptions, CreatePullRequestOptions } from './issue/types';
export type { IssueReporterConfig, RateLimitInfo, IssueFingerprint, CreateIssueOptions, UpdateIssueOptions, CreatePullRequestOptions, IssueTemplateVars, SystemInfo } from './issue/types';
export { DEFAULT_CONFIG as defaultIssueReporterConfig } from './issue/types';
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
export declare class IssueReporter implements IAgent<OrchestratorScenario, {
    issueNumber: number;
    url: string;
} | null>, IPipelineAgent {
    readonly name = "IssueReporter";
    readonly type = AgentType.GITHUB;
    /** @inheritdoc IPipelineAgent */
    readonly isPipelineAgent: true;
    private config;
    private log;
    private formatter;
    private deduplicator;
    private submitter;
    private octokit;
    constructor(config: IssueReporterConfig);
    /** Verify API access and refresh rate limits */
    initialize(): Promise<void>;
    /** Release cached state */
    cleanup(): Promise<void>;
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
    execute(scenario: OrchestratorScenario): Promise<{
        issueNumber: number;
        url: string;
    } | null>;
    /**
     * Create or update a GitHub issue for a test failure.
     * When deduplication is enabled and a matching issue exists, appends a comment
     * instead of creating a new issue.
     */
    createIssue(failure: TestFailure): Promise<{
        issueNumber: number;
        url: string;
    }>;
    /** Update an existing issue */
    updateIssue(issueNumber: number, update: UpdateIssueOptions): Promise<void>;
    /** Search for a duplicate issue for the given failure */
    findDuplicates(failure: TestFailure): Promise<any | null>;
    /** Add a comment to an existing issue */
    addComment(issueNumber: number, comment: string): Promise<void>;
    /**
     * Record a screenshot reference for an issue.
     *
     * Security fix (issue #98): screenshots are never uploaded to external
     * services.  The local path is logged and returned so callers can include
     * it in reports without exposing credentials or sensitive data.
     */
    attachScreenshot(issueNumber: number, screenshotPath: string): Promise<string>;
    /** Create a pull request */
    createPullRequest(options: CreatePullRequestOptions): Promise<{
        prNumber: number;
        url: string;
    }>;
    /** Link issues with a comment */
    linkIssues(issueNumber: number, relatedIssueNumbers: number[], linkType?: 'blocks' | 'duplicates' | 'relates'): Promise<void>;
    /** Assign users to an issue */
    assignUsers(issueNumber: number, assignees: string[]): Promise<void>;
    /** Set a milestone on an issue */
    setMilestone(issueNumber: number, milestoneNumber: number): Promise<void>;
    /** Fetch current GitHub rate limit info */
    getRateLimitInfo(): Promise<RateLimitInfo>;
}
/** Factory function */
export declare function createIssueReporter(config: IssueReporterConfig): IssueReporter;
//# sourceMappingURL=IssueReporter.d.ts.map