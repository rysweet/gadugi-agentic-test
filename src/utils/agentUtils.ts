/**
 * Shared agent helper utilities (issue #118).
 *
 * Contains patterns that appeared verbatim in TUIAgent, CLIAgent, and
 * ElectronUIAgent.  Centralising them here ensures a single place to maintain
 * and test these behaviours.
 */

/**
 * Return a safe copy of `config` where the value at `envField` is replaced by
 * a sorted array of its own keys.
 *
 * This is the pattern shared by TUIAgent.sanitizeConfig() (field name
 * `environment`) and ElectronUIAgent.sanitizeConfig() (field name `env`):
 *
 * ```typescript
 * // TUIAgent
 * const { environment, ...safeConfig } = this.config;
 * return { ...safeConfig, environment: environment ? Object.keys(environment) : undefined };
 *
 * // ElectronUIAgent
 * const { env, ...safeConfig } = this.config;
 * return { ...safeConfig, env: env ? Object.keys(env) : undefined };
 * ```
 *
 * Usage:
 * ```typescript
 * // TUIAgent
 * sanitizeConfigWithEnv(this.config, 'environment')
 *
 * // ElectronUIAgent
 * sanitizeConfigWithEnv(this.config, 'env')
 * ```
 *
 * @param config   The agent config object to sanitize.
 * @param envField The key whose value should be replaced with its key list.
 * @returns A new object with `envField` replaced by `string[] | undefined`.
 */
export function sanitizeConfigWithEnv<
  K extends string,
  T extends Record<K, Record<string, unknown> | undefined>
>(config: T, envField: K): Omit<T, K> & { [P in K]: string[] | undefined } {
  const { [envField]: envValue, ...rest } = config as Record<string, unknown>;
  const sanitizedEnv = envValue != null ? Object.keys(envValue as Record<string, unknown>) : undefined;
  return { ...rest, [envField]: sanitizedEnv } as Omit<T, K> & { [P in K]: string[] | undefined };
}

type WorkingDirectoryConfig = {
  workingDirectory?: unknown;
  cwd?: unknown;
};

export function hasWorkingDirectoryConfig(config: WorkingDirectoryConfig | undefined): boolean {
  return config !== undefined
    && (Object.prototype.hasOwnProperty.call(config, 'workingDirectory')
      || Object.prototype.hasOwnProperty.call(config, 'cwd'));
}

/**
 * Resolve the supported scenario-agent working-directory spellings.
 * `workingDirectory` is canonical and wins over the YAML-compatible `cwd` alias.
 */
export function resolveWorkingDirectoryConfig(
  config: WorkingDirectoryConfig | undefined,
  ownerLabel: string
): string | undefined {
  if (config === undefined) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(config, 'workingDirectory')) {
    return requireNonEmptyWorkingDirectory(config.workingDirectory, 'workingDirectory', ownerLabel);
  }

  if (Object.prototype.hasOwnProperty.call(config, 'cwd')) {
    return requireNonEmptyWorkingDirectory(config.cwd, 'cwd', ownerLabel);
  }

  return undefined;
}

function requireNonEmptyWorkingDirectory(
  value: unknown,
  fieldName: 'workingDirectory' | 'cwd',
  ownerLabel: string
): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Invalid scenario agent ${fieldName} for "${ownerLabel}": expected a non-empty string`);
}
