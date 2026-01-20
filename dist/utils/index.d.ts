/**
 * Utilities module - Comprehensive utilities and helpers for the Agentic Testing System
 */
export * from './logger';
export * from './yamlParser';
export * from './config';
export * from './retry';
export * from './screenshot';
export * from './fileUtils';
import winston from 'winston';
export declare const createLegacyLogger: (level?: string) => winston.Logger;
export declare const legacyLogger: winston.Logger;
export declare class LegacyConfigManager {
    private static config;
    static set(key: string, value: any): void;
    static get<T = any>(key: string, defaultValue?: T): T;
    static has(key: string): boolean;
    static loadFromEnv(): void;
}
export declare class TimeUtils {
    static delay(ms: number): Promise<void>;
    static timeout<T>(promise: Promise<T>, ms: number): Promise<T>;
    static measureTime<T>(fn: () => Promise<T>): Promise<{
        result: T;
        duration: number;
    }>;
}
export declare class StringUtils {
    static interpolate(template: string, variables: Record<string, string>): string;
    static slugify(text: string): string;
}
//# sourceMappingURL=index.d.ts.map