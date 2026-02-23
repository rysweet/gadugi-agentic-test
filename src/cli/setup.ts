/**
 * CLI-only process lifecycle helpers.
 *
 * This module installs global signal handlers and is intentionally
 * NOT exported from the library public API (src/lib.ts or src/index.ts).
 * It must only be imported from CLI entry points (src/cli.ts, src/main.ts).
 *
 * Library consumers who need graceful shutdown should handle signals in
 * their own process management code, calling orchestrator.abort() directly.
 */

import { logger } from '../utils/logger';
import { TestOrchestrator } from '../orchestrator';

/**
 * Install process-level signal and error handlers for graceful shutdown.
 *
 * Registers handlers for SIGINT, SIGTERM, uncaughtException, and
 * unhandledRejection.  Each handler calls orchestrator.abort() then
 * schedules a forced exit after 5 seconds if the process has not
 * already exited.
 *
 * @param orchestrator - The TestOrchestrator instance to abort on signal.
 * @param proc - The process object to register handlers on. Defaults to
 *               the global \`process\`. Accepts a custom value for testing.
 *
 * @example
 * // In a CLI entry point only:
 * import { setupGracefulShutdown } from './cli/setup';
 * const orchestrator = createTestOrchestrator(config);
 * setupGracefulShutdown(orchestrator);
 */
export function setupGracefulShutdown(
  orchestrator: TestOrchestrator,
  proc: Pick<NodeJS.Process, 'on'> = process
): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    orchestrator.abort();
    setTimeout(() => {
      logger.warn('Forcing shutdown');
      process.exit(1);
    }, 5000);
  };

  proc.on('SIGINT',  () => shutdown('SIGINT'));
  proc.on('SIGTERM', () => shutdown('SIGTERM'));

  proc.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', { reason });
    process.exit(1);
  });

  proc.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}
