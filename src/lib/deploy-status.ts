import type { DeployStatusValue, Service, ServiceStatus } from '@/types/releasea';

const DEPLOY_ACTION_BLOCKED_STATUSES = new Set<string>([
  'requested',
  'scheduled',
  'preparing',
  'deploying',
  'retrying',
]);
const LIVE_DEPLOY_STATUSES = new Set<string>([
  'requested',
  'scheduled',
  'preparing',
  'deploying',
  'validating',
  'progressing',
  'promoting',
  'retrying',
  'rollback',
]);
const SUCCESSFUL_DEPLOY_STATUSES = new Set<string>(['completed']);
const FAILED_DEPLOY_STATUSES = new Set<string>(['failed', 'rollback']);
const RUNTIME_ERROR_STATUSES = new Set<string>(['error', 'crashloop']);
const RUNTIME_TRANSITION_STATUSES = new Set<string>(['pending', 'unknown']);
const NON_RUNTIME_SERVICE_STATUSES = new Set<ServiceStatus>(['creating', 'created', 'deleting', 'stopped', 'idle']);

const normalizeDeployStatusMap: Record<string, string> = {
  queued: 'scheduled',
  'in-progress': 'deploying',
  success: 'completed',
};

export const normalizeDeployStatusValue = (
  status?: DeployStatusValue | string | null,
): string | null => {
  if (typeof status !== 'string') {
    return null;
  }
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return normalizeDeployStatusMap[normalized] ?? normalized;
};

const hasStatus = (statuses: Set<string>, status?: DeployStatusValue | string | null): boolean => {
  const normalized = normalizeDeployStatusValue(status);
  return normalized != null && statuses.has(normalized);
};

export const isDeployActionBlockedStatus = (status?: DeployStatusValue | string | null): boolean =>
  hasStatus(DEPLOY_ACTION_BLOCKED_STATUSES, status);

export const isLiveDeployStatus = (status?: DeployStatusValue | string | null): boolean =>
  hasStatus(LIVE_DEPLOY_STATUSES, status);

export const isSuccessfulDeployStatus = (status?: DeployStatusValue | string | null): boolean =>
  hasStatus(SUCCESSFUL_DEPLOY_STATUSES, status);

export const isFailedDeployStatus = (status?: DeployStatusValue | string | null): boolean =>
  hasStatus(FAILED_DEPLOY_STATUSES, status);

export const parseDeployTimestamp = (...values: Array<string | null | undefined>): number => {
  for (const value of values) {
    if (!value) {
      continue;
    }
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const normalizeRuntimeEnvironment = (value?: string | null): string => {
  const normalized = (value ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'prod':
    case 'production':
    case 'live':
      return 'prod';
    case 'staging':
    case 'stage':
    case 'pre-prod':
    case 'preprod':
    case 'uat':
      return 'staging';
    case 'dev':
    case 'development':
    case 'qa':
    case 'sandbox':
    case 'test':
    case 'testing':
    case 'preview':
    case 'local':
      return 'dev';
    default:
      return normalized;
  }
};

const runtimeStatusToDisplay = (runtimeStatus: string, fallback: ServiceStatus): ServiceStatus => {
  if (RUNTIME_ERROR_STATUSES.has(runtimeStatus)) {
    return 'error';
  }
  if (runtimeStatus === 'degraded') {
    return fallback === 'stopped' || fallback === 'idle' ? fallback : 'running';
  }
  if (RUNTIME_TRANSITION_STATUSES.has(runtimeStatus)) {
    return fallback === 'running' || fallback === 'error' ? 'running' : 'pending';
  }
  if (runtimeStatus === 'healthy') {
    return 'running';
  }
  return fallback;
};

export const resolveServiceStatusForDisplay = (options: {
  service: Service;
  environment?: string | null;
  latestDeployStatus?: DeployStatusValue | string | null;
}): ServiceStatus | DeployStatusValue => {
  const { service, environment, latestDeployStatus } = options;
  const normalizedDeployStatus = normalizeDeployStatusValue(latestDeployStatus);

  if (isLiveDeployStatus(normalizedDeployStatus)) {
    return normalizedDeployStatus as DeployStatusValue;
  }

  const normalizedEnvironment = normalizeRuntimeEnvironment(environment);
  const runtimeStatus = normalizedEnvironment
    ? service.runtime?.[normalizedEnvironment]?.status
    : undefined;

  if (normalizedEnvironment) {
    if (runtimeStatus) {
      return runtimeStatusToDisplay(runtimeStatus, service.status);
    }
    if (service.status === 'creating' || service.status === 'created' || service.status === 'deleting') {
      return service.status;
    }
    return 'idle';
  }

  if (NON_RUNTIME_SERVICE_STATUSES.has(service.status)) {
    return service.status;
  }

  if (!runtimeStatus) {
    return service.status;
  }
  return runtimeStatusToDisplay(runtimeStatus, service.status);
};
