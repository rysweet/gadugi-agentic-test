/**
 * IssueFormatter - Renders issue title and body from template variables
 */

import { TestFailure } from '../../models/TestModels';
import { IssueReporterConfig, IssueTemplateVars, SystemInfo, CreateIssueOptions } from './types';
import { IssueDeduplicator } from './IssueDeduplicator';

/**
 * Formats GitHub issue content (title and body) from test failures using templates.
 */
export class IssueFormatter {
  private config: IssueReporterConfig;
  private deduplicator: IssueDeduplicator;

  constructor(config: IssueReporterConfig) {
    this.config = config;
    this.deduplicator = new IssueDeduplicator();
  }

  /**
   * Generate complete issue creation options from a test failure
   */
  async generateIssueContent(failure: TestFailure): Promise<CreateIssueOptions> {
    const systemInfo = await this.getSystemInfo();
    const templateVars: IssueTemplateVars = {
      scenarioId: failure.scenarioId,
      scenarioName: failure.scenarioId,
      failureMessage: failure.message,
      ...(failure.stackTrace !== undefined ? { stackTrace: failure.stackTrace } : {}),
      timestamp: failure.timestamp.toISOString(),
      environment: this.getSafeEnvironment(),
      ...(failure.screenshots !== undefined ? { screenshots: failure.screenshots } : {}),
      ...(failure.logs !== undefined ? { logs: failure.logs } : {}),
      reproductionSteps: this.generateReproductionSteps(failure),
      systemInfo,
      priority: this.determinePriority(failure),
      ...(failure.category !== undefined ? { category: failure.category } : {}),
    };

    const title = this.renderTemplate(this.config.issueTitleTemplate, templateVars);
    const body = this.renderTemplate(this.config.issueBodyTemplate, templateVars);

    // Embed fingerprint for deduplication
    const fingerprint = this.deduplicator.generateFingerprint(failure);
    const bodyWithFingerprint = `${body}\n\n<!-- fingerprint:${fingerprint.hash} -->`;

    return {
      title,
      body: this.truncateBody(bodyWithFingerprint),
      labels: [...(this.config.issueLabels || []), this.determinePriorityLabel(failure)],
      assignees: this.config.autoAssignUsers
    };
  }

  /**
   * Render template with variables, handling object properties, arrays, and conditional blocks
   */
  renderTemplate(template: string, vars: IssueTemplateVars): string {
    let rendered = template;

    Object.entries(vars).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          rendered = rendered.replace(
            new RegExp(`{{${key}\\.(\\w+)}}`, 'g'),
            (_match, prop) => (value as Record<string, any>)[prop] || _match
          );
        } else if (Array.isArray(value)) {
          rendered = rendered.replace(
            new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, 'g'),
            (_match, content) => {
              if (value.length === 0) return '';
              return value.map((item: unknown) => content.replace(/{{this}}/g, String(item))).join('');
            }
          );
        } else {
          rendered = rendered.replace(
            new RegExp(`{{${key}}}`, 'g'),
            String(value)
          );
        }
      }
    });

    // Handle remaining conditional blocks
    rendered = rendered.replace(
      /{{#(\w+)}}([\s\S]*?){{\/\1}}/g,
      (_match, key, content) => {
        const value = vars[key as keyof IssueTemplateVars];
        return (value && ((Array.isArray(value) && value.length > 0) || (!Array.isArray(value) && value !== '')))
          ? content
          : '';
      }
    );

    return rendered;
  }

  /**
   * Determine human-readable priority from failure attributes
   */
  determinePriority(failure: TestFailure): string {
    if (failure.category === 'critical' || failure.message.toLowerCase().includes('critical')) {
      return 'Critical';
    } else if (failure.message.toLowerCase().includes('error')) {
      return 'High';
    } else {
      return 'Medium';
    }
  }

  /**
   * Determine priority label string for GitHub labeling
   */
  determinePriorityLabel(failure: TestFailure): string {
    return `priority:${this.determinePriority(failure).toLowerCase()}`;
  }

  /**
   * Generate reproduction steps from failure metadata
   */
  generateReproductionSteps(failure: TestFailure): string[] {
    const steps = [
      `Run test scenario: ${failure.scenarioId}`,
      'Execute the test steps as defined in the scenario'
    ];

    if (failure.failedStep !== undefined) {
      steps.push(`Failure occurs at step ${failure.failedStep + 1}`);
    }

    if (failure.category) {
      steps.push(`Note: This is a ${failure.category} type failure`);
    }

    return steps;
  }

  /**
   * Return a safe subset of environment variables (never includes secrets)
   */
  private getSafeEnvironment(): Record<string, string> {
    const SAFE_KEYS = ['NODE_ENV', 'CI', 'GITHUB_ACTIONS', 'GITHUB_RUN_ID',
      'GITHUB_WORKFLOW', 'RUNNER_OS', 'RUNNER_ARCH', 'GITHUB_REF', 'GITHUB_SHA'];
    const safe: Record<string, string> = {};
    for (const key of SAFE_KEYS) {
      if (process.env[key]) safe[key] = process.env[key]!;
    }
    return safe;
  }

  /**
   * Collect system information for the issue body
   */
  private async getSystemInfo(): Promise<SystemInfo> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      ...(process.versions.electron !== undefined ? { electronVersion: process.versions.electron } : {}),
      timestamp: new Date().toISOString(),
      workingDirectory: process.cwd(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        CI: process.env.CI || 'false'
      }
    };
  }

  /**
   * Truncate body to the configured maximum length
   */
  private truncateBody(body: string): string {
    if (body.length <= this.config.maxBodyLength!) {
      return body;
    }

    const truncated = body.substring(0, this.config.maxBodyLength! - 100);
    return `${truncated}\n\n...\n\n*Content truncated due to length limit*`;
  }
}
