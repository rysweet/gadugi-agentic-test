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
