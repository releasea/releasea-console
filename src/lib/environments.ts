import type { Environment, EnvironmentConfig } from '@/types/releasea';

const STORAGE_KEY = 'releasea.environments';

const DEFAULT_ENVIRONMENTS: EnvironmentConfig[] = [
  {
    id: 'dev',
    name: 'Development',
    description: 'Internal testing and experiments',
  },
  {
    id: 'staging',
    name: 'Staging',
    description: 'Pre-production validation',
  },
  {
    id: 'prod',
    name: 'Production',
    description: 'Customer facing workloads',
  },
];

const mergeWithDefaults = (configs: EnvironmentConfig[]) => {
  const byId = new Map(configs.map((config) => [config.id, config]));
  return DEFAULT_ENVIRONMENTS.map((env) => ({
    ...env,
    ...(byId.get(env.id) ?? {}),
  }));
};

export const getEnvironmentConfigs = (): EnvironmentConfig[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_ENVIRONMENTS;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_ENVIRONMENTS;
  }

  try {
    const parsed = JSON.parse(stored) as EnvironmentConfig[];
    if (!Array.isArray(parsed)) {
      return DEFAULT_ENVIRONMENTS;
    }
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_ENVIRONMENTS;
  }
};

export const saveEnvironmentConfigs = (configs: EnvironmentConfig[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
};

export const resetEnvironmentConfigs = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};

export const getEnvironmentLabel = (environment: Environment | string) => {
  const configs = getEnvironmentConfigs();
  return configs.find((config) => config.id === environment)?.name ?? environment;
};

// ---------------------------------------------------------------------------
// Namespace resolution - mirrors the backend resolveAppNamespace logic.
// This is the frontend SINGLE SOURCE OF TRUTH for environment→namespace mapping.
// ---------------------------------------------------------------------------

export const NAMESPACE_PRODUCTION = 'releasea-apps-production';
export const NAMESPACE_STAGING = 'releasea-apps-staging';
export const NAMESPACE_DEVELOPMENT = 'releasea-apps-development';
export const NAMESPACE_SYSTEM = 'releasea-system';

const NAMESPACE_MAPPING: Record<string, string> = {
  prod: NAMESPACE_PRODUCTION,
  production: NAMESPACE_PRODUCTION,
  live: NAMESPACE_PRODUCTION,

  staging: NAMESPACE_STAGING,
  stage: NAMESPACE_STAGING,
  'pre-prod': NAMESPACE_STAGING,
  preprod: NAMESPACE_STAGING,
  uat: NAMESPACE_STAGING,
  'pre-release': NAMESPACE_STAGING,

  dev: NAMESPACE_DEVELOPMENT,
  development: NAMESPACE_DEVELOPMENT,
  qa: NAMESPACE_DEVELOPMENT,
  sandbox: NAMESPACE_DEVELOPMENT,
  test: NAMESPACE_DEVELOPMENT,
  testing: NAMESPACE_DEVELOPMENT,
  preview: NAMESPACE_DEVELOPMENT,
  feature: NAMESPACE_DEVELOPMENT,
  ci: NAMESPACE_DEVELOPMENT,
  local: NAMESPACE_DEVELOPMENT,
};

/**
 * Resolves an environment name to one of the three fixed application namespaces.
 * Unknown environments default to releasea-apps-development.
 * Never returns releasea-system.
 */
export const resolveNamespace = (environment: string): string => {
  const key = (environment || 'prod').trim().toLowerCase();
  return NAMESPACE_MAPPING[key] ?? NAMESPACE_DEVELOPMENT;
};

/**
 * Returns true when two environments resolve to the same namespace.
 */
export const environmentsShareNamespace = (envA: string, envB: string): boolean =>
  resolveNamespace(envA) === resolveNamespace(envB);
