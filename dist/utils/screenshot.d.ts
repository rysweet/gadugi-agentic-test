/**
 * Screenshot utilities for Playwright-based testing
 * Handles capture, comparison, organization, and management of screenshots
 */
import { Page, Locator } from 'playwright';
/**
 * Screenshot options interface
 */
export interface ScreenshotOptions {
    /** Output file path (if not provided, auto-generated) */
    path?: string;
    /** Screenshot type */
    type?: 'png' | 'jpeg';
    /** JPEG quality (0-100, only for JPEG) */
    quality?: number;
    /** Whether to capture full page */
    fullPage?: boolean;
    /** Specific clip area */
    clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Animation handling */
    animations?: 'disabled' | 'allow';
    /** Mask specific elements */
    mask?: Locator[];
    /** Omit background (transparent) */
    omitBackground?: boolean;
    /** Timeout in milliseconds */
    timeout?: number;
}
/**
 * Screenshot metadata interface
 */
export interface ScreenshotMetadata {
    /** File path */
    filePath: string;
    /** Filename */
    fileName: string;
    /** Timestamp when captured */
    timestamp: Date;
    /** Test scenario ID */
    scenarioId?: string;
    /** Test step index */
    stepIndex?: number;
    /** Screenshot description */
    description?: string;
    /** Page URL when captured */
    url?: string;
    /** Viewport size */
    viewport?: {
        width: number;
        height: number;
    };
    /** File size in bytes */
    fileSize?: number;
    /** Additional tags */
    tags?: string[];
    /** Hash for deduplication */
    hash?: string;
}
/**
 * Diff algorithm options
 */
export type DiffAlgorithm = 'pixel-by-pixel' | 'perceptual' | 'structural';
/**
 * Diff color coding options
 */
export interface DiffColorOptions {
    /** Color for removed pixels (default: red) */
    removedColor?: [number, number, number];
    /** Color for added pixels (default: green) */
    addedColor?: [number, number, number];
    /** Color for changed pixels (default: yellow) */
    changedColor?: [number, number, number];
    /** Alpha value for diff overlay (0-255, default: 255) */
    alpha?: number;
}
/**
 * Screenshot comparison options
 */
export interface ComparisonOptions {
    /** Similarity threshold (0-1, default: 0.1) */
    threshold?: number;
    /** Diff algorithm to use */
    algorithm?: DiffAlgorithm;
    /** Whether to include antialiasing detection */
    includeAA?: boolean;
    /** Color options for diff visualization */
    colorOptions?: DiffColorOptions;
    /** Whether to create a diff image */
    createDiffImage?: boolean;
}
/**
 * Screenshot comparison result
 */
export interface ComparisonResult {
    /** Whether screenshots match within threshold */
    matches: boolean;
    /** Difference percentage (0-100) */
    differencePercentage: number;
    /** Similarity percentage (0-100) */
    similarityPercentage: number;
    /** Path to difference image */
    diffImagePath?: string;
    /** Comparison metadata */
    metadata: {
        baselineImage: string;
        actualImage: string;
        threshold: number;
        algorithm: DiffAlgorithm;
        pixelCount: number;
        differentPixels: number;
        baselineSize: {
            width: number;
            height: number;
        };
        actualSize: {
            width: number;
            height: number;
        };
        resized: boolean;
    };
}
/**
 * Screenshot organization options
 */
export interface OrganizationOptions {
    /** Base directory for screenshots */
    baseDir: string;
    /** Organization strategy */
    strategy: 'flat' | 'by-date' | 'by-scenario' | 'by-run';
    /** Run ID for organization */
    runId?: string;
    /** Whether to include timestamps in filenames */
    includeTimestamp: boolean;
    /** Maximum number of screenshots per directory */
    maxPerDirectory?: number;
}
/**
 * Screenshot manager class
 */
export declare class ScreenshotManager {
    private organizationOptions;
    private metadata;
    private runId;
    constructor(options?: Partial<OrganizationOptions>);
    /**
     * Capture a screenshot of the page
     */
    capturePageScreenshot(page: Page, options?: ScreenshotOptions & {
        scenarioId?: string;
        stepIndex?: number;
        description?: string;
    }): Promise<ScreenshotMetadata>;
    /**
     * Capture a screenshot of a specific element
     */
    captureElementScreenshot(element: Locator, options?: ScreenshotOptions & {
        scenarioId?: string;
        stepIndex?: number;
        description?: string;
    }): Promise<ScreenshotMetadata>;
    /**
     * Capture multiple screenshots in sequence
     */
    captureSequence(page: Page, count: number, interval: number, options?: ScreenshotOptions & {
        scenarioId?: string;
        description?: string;
    }): Promise<ScreenshotMetadata[]>;
    /**
     * Capture before/after comparison screenshots
     */
    captureComparison(page: Page, action: () => Promise<void>, options?: ScreenshotOptions & {
        scenarioId?: string;
        stepIndex?: number;
        description?: string;
    }): Promise<{
        before: ScreenshotMetadata;
        after: ScreenshotMetadata;
    }>;
    /**
     * Compare two screenshots with advanced pixel-level comparison
     */
    compareScreenshots(baselineImage: string, actualImage: string, options?: ComparisonOptions): Promise<ComparisonResult>;
    /**
     * Create a visual difference image with color coding
     * @deprecated Use createDiff instead for more advanced functionality
     */
    createDifferenceImage(baselineImage: string, actualImage: string, outputPath: string): Promise<string>;
    /**
     * Create an advanced visual difference image with multiple diff algorithms
     * and customizable color coding
     */
    createDiff(baselineImage: string, actualImage: string, outputPath: string, options?: {
        algorithm?: DiffAlgorithm;
        colorOptions?: DiffColorOptions;
        includeAA?: boolean;
        showSideBySide?: boolean;
    }): Promise<string>;
    /**
     * Create pixel-by-pixel difference image
     */
    private createPixelDiff;
    /**
     * Create perceptual difference image (focuses on human-visible differences)
     */
    private createPerceptualDiff;
    /**
     * Create structural difference image (focuses on edges and shapes)
     */
    private createStructuralDiff;
    /**
     * Simple edge detection using Sobel filter
     */
    private detectEdges;
    /**
     * Get all screenshots for a scenario
     */
    getScreenshotsByScenario(scenarioId: string): ScreenshotMetadata[];
    /**
     * Get all screenshots for a specific step
     */
    getScreenshotsByStep(scenarioId: string, stepIndex: number): ScreenshotMetadata[];
    /**
     * Clean up old screenshots
     */
    cleanupOldScreenshots(maxAge?: number): Promise<number>;
    /**
     * Archive screenshots for a completed run
     */
    archiveRun(archivePath?: string): Promise<string>;
    /**
     * Generate a unique filename
     */
    private generateFilePath;
    /**
     * Get directory path based on organization strategy
     */
    private getDirectoryPath;
    /**
     * Sanitize filename for filesystem compatibility
     */
    private sanitizeFilename;
    /**
     * Generate unique run ID
     */
    private generateRunId;
    /**
     * Calculate hash for file deduplication
     */
    private calculateHash;
    /**
     * Ensure directory exists
     */
    private ensureDirectoryExists;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Export metadata to JSON
     */
    exportMetadata(filePath?: string): Promise<string>;
    /**
     * Batch compare multiple screenshot pairs
     */
    batchCompareScreenshots(comparisons: Array<{
        baseline: string;
        actual: string;
        name: string;
        options?: ComparisonOptions;
    }>): Promise<Array<ComparisonResult & {
        name: string;
    }>>;
    /**
     * Calculate similarity score using multiple algorithms
     */
    calculateSimilarityScore(baseline: string, actual: string, options?: {
        weights?: {
            pixel: number;
            perceptual: number;
            structural: number;
        };
    }): Promise<{
        overall: number;
        pixel: number;
        perceptual: number;
        structural: number;
    }>;
    /**
     * Generate comparison report
     */
    generateComparisonReport(results: Array<ComparisonResult & {
        name: string;
    }>, outputPath?: string): Promise<string>;
    /**
     * Get run statistics
     */
    getRunStatistics(): {
        runId: string;
        totalScreenshots: number;
        byScenario: Record<string, number>;
        totalSizeBytes: number;
        totalSizeMB: number;
        oldestScreenshot: number | null;
        newestScreenshot: number | null;
    };
}
/**
 * Create a screenshot manager instance
 */
export declare function createScreenshotManager(options?: Partial<OrganizationOptions>): ScreenshotManager;
/**
 * Convenience function for quick page screenshot
 */
export declare function capturePageScreenshot(page: Page, filePath: string, options?: ScreenshotOptions): Promise<void>;
/**
 * Convenience function for quick element screenshot
 */
export declare function captureElementScreenshot(element: Locator, filePath: string, options?: ScreenshotOptions): Promise<void>;
//# sourceMappingURL=screenshot.d.ts.map