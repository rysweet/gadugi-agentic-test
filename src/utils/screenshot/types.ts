/**
 * Shared types for screenshot sub-modules
 */

import { Locator } from 'playwright';

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
  viewport?: { width: number; height: number };
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
    baselineSize: { width: number; height: number };
    actualSize: { width: number; height: number };
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
 * Default screenshot options
 */
export const DEFAULT_OPTIONS: ScreenshotOptions = {
  type: 'png',
  fullPage: false,
  animations: 'disabled',
  timeout: 30000,
};

/**
 * Default organization options
 */
export const DEFAULT_ORGANIZATION: OrganizationOptions = {
  baseDir: './screenshots',
  strategy: 'by-scenario',
  includeTimestamp: true,
};
