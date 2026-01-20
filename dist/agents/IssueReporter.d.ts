/**
 * GitHub Issue Reporter Agent
 *
 * Handles GitHub issue creation and management for test failures.
 * Supports issue deduplication, template-based creation, and comprehensive
 * GitHub API integration with rate limiting and error handling.
 */
import { TestFailure } from '../models/TestModels';
import { GitHubConfig } from '../models/Config';
import { IAgent, AgentType } from './index';
/**
 * GitHub API rate limit information
 */
export interface RateLimitInfo {
    limit: number;
    used: number;
    remaining: number;
    reset: Date;
}
/**
 * Issue fingerprint for deduplication
 */
export interface IssueFingerprint {
    scenarioId: string;
    errorMessage: string;
    stackTraceHash?: string;
    category?: string;
    hash: string;
}
/**
 * GitHub issue creation options
 */
export interface CreateIssueOptions {
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
    milestone?: number;
    projects?: number[];
}
/**
 * GitHub issue update options
 */
export interface UpdateIssueOptions {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
    milestone?: number | null;
}
/**
 * GitHub pull request creation options
 */
export interface CreatePullRequestOptions {
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
    maintainer_can_modify?: boolean;
}
/**
 * Issue template variables
 */
export interface IssueTemplateVars {
    scenarioId: string;
    scenarioName: string;
    failureMessage: string;
    stackTrace?: string;
    timestamp: string;
    environment: Record<string, any>;
    screenshots?: string[];
    logs?: string[];
    reproductionSteps: string[];
    systemInfo: Record<string, any>;
    priority: string;
    category?: string;
}
/**
 * System information for issues
 */
export interface SystemInfo {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion?: string;
    timestamp: string;
    workingDirectory: string;
    environment: Record<string, string>;
}
/**
 * Issue Reporter agent configuration
 */
export interface IssueReporterConfig extends GitHubConfig {
    /** GitHub API base URL (for Enterprise) */
    baseUrl?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Rate limit buffer (requests to keep in reserve) */
    rateLimitBuffer?: number;
    /** Custom issue templates directory */
    templatesDir?: string;
    /** Screenshot storage configuration */
    screenshotStorage?: 'embed' | 'link' | 'attach';
    /** Maximum issue body length */
    maxBodyLength?: number;
    /** Issue deduplication enabled */
    enableDeduplication?: boolean;
    /** Days to look back for duplicate issues */
    deduplicationLookbackDays?: number;
}
/**
 * Default configuration values
 */
declare const DEFAULT_CONFIG: Partial<IssueReporterConfig>;
/**
 * GitHub Issue Reporter Agent
 *
 * Provides comprehensive GitHub integration for test failure reporting
 * and issue management with advanced features like deduplication,
 * template-based issue creation, and rate limiting.
 */
export declare class IssueReporter implements IAgent {
    readonly name = "IssueReporter";
    readonly type = AgentType.GITHUB;
    private octokit;
    private config;
    private logger;
    private rateLimitInfo;
    private issueTemplates;
    private fingerprintCache;
    constructor(config: IssueReporterConfig);
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Execute scenario (not applicable for this agent)
     */
    execute(scenario: any): Promise<any>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    /**
     * Create a GitHub issue from a test failure
     */
    createIssue(failure: TestFailure): Promise<{
        issueNumber: number;
        url: string;
    }>;
    /**
     * Update an existing GitHub issue
     */
    updateIssue(issueNumber: number, update: UpdateIssueOptions): Promise<void>;
    /**
     * Find duplicate issues for a test failure
     */
    findDuplicates(failure: TestFailure): Promise<any | null>;
    /**
     * Add a comment to an existing issue
     */
    addComment(issueNumber: number, comment: string): Promise<void>;
    /**
     * Attach screenshots to an issue
     */
    attachScreenshot(issueNumber: number, screenshotPath: string): Promise<string>;
    /**
     * Create a pull request for fixes
     */
    createPullRequest(options: CreatePullRequestOptions): Promise<{
        prNumber: number;
        url: string;
    }>;
    /**
     * Link issues to each other
     */
    linkIssues(issueNumber: number, relatedIssueNumbers: number[], linkType?: 'blocks' | 'duplicates' | 'relates'): Promise<void>;
    /**
     * Assign users to an issue
     */
    assignUsers(issueNumber: number, assignees: string[]): Promise<void>;
    /**
     * Set milestone for an issue
     */
    setMilestone(issueNumber: number, milestoneNumber: number): Promise<void>;
    /**
     * Get current rate limit information
     */
    getRateLimitInfo(): Promise<RateLimitInfo>;
    /**
     * Generate issue fingerprint for deduplication
     */
    private generateFingerprint;
    /**
     * Generate issue content from test failure
     */
    private generateIssueContent;
    /**
     * Render template with variables
     */
    private renderTemplate;
    /**
     * Generate reproduction steps from failure
     */
    private generateReproductionSteps;
    /**
     * Determine issue priority from failure
     */
    private determinePriority;
    /**
     * Determine priority label
     */
    private determinePriorityLabel;
    /**
     * Get system information
     */
    private getSystemInfo;
    /**
     * Truncate body to maximum length
     */
    private truncateBody;
    /**
     * Verify GitHub API access
     */
    private verifyAccess;
    /**
     * Update rate limit information
     */
    private updateRateLimitInfo;
    /**
     * Check rate limit and wait if necessary
     */
    private checkRateLimit;
    /**
     * Load custom templates from directory
     */
    private loadCustomTemplates;
}
/**
 * Create an IssueReporter agent instance
 */
export declare function createIssueReporter(config: IssueReporterConfig): IssueReporter;
/**
 * Export default configuration for reference
 */
export { DEFAULT_CONFIG as defaultIssueReporterConfig };
//# sourceMappingURL=IssueReporter.d.ts.map