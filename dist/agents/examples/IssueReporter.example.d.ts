/**
 * IssueReporter Agent Usage Examples
 *
 * Demonstrates how to use the IssueReporter agent for GitHub integration
 * in test failure scenarios.
 */
import { IssueReporterConfig } from '../IssueReporter';
import { TestFailure } from '../../models/TestModels';
/**
 * Example configuration for GitHub integration
 */
declare const exampleConfig: IssueReporterConfig;
/**
 * Example test failure data
 */
declare const exampleFailure: TestFailure;
/**
 * Basic usage example
 */
declare function basicUsageExample(): Promise<void>;
/**
 * Advanced features example
 */
declare function advancedFeaturesExample(): Promise<void>;
/**
 * Pull request creation example
 */
declare function pullRequestExample(): Promise<void>;
/**
 * Batch operations example
 */
declare function batchOperationsExample(): Promise<void>;
/**
 * Run all examples
 */
declare function runAllExamples(): Promise<void>;
export { basicUsageExample, advancedFeaturesExample, pullRequestExample, batchOperationsExample, runAllExamples, exampleConfig, exampleFailure };
//# sourceMappingURL=IssueReporter.example.d.ts.map