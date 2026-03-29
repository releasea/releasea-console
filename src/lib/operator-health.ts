import { isFailedDeployStatus, isLiveDeployStatus, isSuccessfulDeployStatus, parseDeployTimestamp } from '@/lib/deploy-status';
import type { Deploy, ProviderHealthCatalog, WorkerPool } from '@/types/releasea';

export type OperatorHealthLevel = 'healthy' | 'review' | 'degraded';

export interface OperatorHealthLane {
  id: 'providers' | 'workers' | 'delivery';
  label: string;
  level: OperatorHealthLevel;
  summary: string;
  detail: string;
  href: string;
}

export interface OperatorHealthReport {
  level: OperatorHealthLevel;
  summary: string;
  lanes: OperatorHealthLane[];
}

const HEALTH_RANK: Record<OperatorHealthLevel, number> = {
  healthy: 0,
  review: 1,
  degraded: 2,
};

const maxHealthLevel = (levels: OperatorHealthLevel[]): OperatorHealthLevel =>
  levels.reduce<OperatorHealthLevel>(
    (current, next) => (HEALTH_RANK[next] > HEALTH_RANK[current] ? next : current),
    'healthy',
  );

export const buildOperatorHealthReport = (input: {
  providerHealth: ProviderHealthCatalog | null;
  workerPools: WorkerPool[];
  deploys: Deploy[];
}): OperatorHealthReport => {
  const providerLane = buildProviderLane(input.providerHealth);
  const workerLane = buildWorkerLane(input.workerPools);
  const deliveryLane = buildDeliveryLane(input.deploys);
  const lanes = [providerLane, workerLane, deliveryLane];
  const level = maxHealthLevel(lanes.map((lane) => lane.level));
  const degradedCount = lanes.filter((lane) => lane.level === 'degraded').length;
  const reviewCount = lanes.filter((lane) => lane.level === 'review').length;

  const summary =
    level === 'healthy'
      ? 'Control plane, workers, and recent delivery signals look healthy.'
      : level === 'degraded'
        ? `${degradedCount} area${degradedCount === 1 ? '' : 's'} need immediate attention.`
        : `${reviewCount} area${reviewCount === 1 ? '' : 's'} should be reviewed before the next production change.`;

  return {
    level,
    summary,
    lanes,
  };
};

const buildProviderLane = (providerHealth: ProviderHealthCatalog | null): OperatorHealthLane => {
  if (!providerHealth) {
    return {
      id: 'providers',
      label: 'Integrations',
      level: 'review',
      summary: 'No live provider checks loaded.',
      detail: 'Run provider health checks from the Dashboard or Settings before production changes.',
      href: '/settings?tab=credentials',
    };
  }

  const categories = [
    providerHealth.scm,
    providerHealth.registry,
    providerHealth.secrets,
    providerHealth.identity,
    providerHealth.notifications,
  ];
  const unhealthy = categories.reduce((sum, category) => sum + (category?.unhealthy ?? 0), 0);
  const unsupported = categories.reduce((sum, category) => sum + (category?.unsupported ?? 0), 0);
  const healthy = categories.reduce((sum, category) => sum + (category?.healthy ?? 0), 0);

  if (unhealthy > 0) {
    return {
      id: 'providers',
      label: 'Integrations',
      level: 'degraded',
      summary: `${unhealthy} unhealthy provider check${unhealthy === 1 ? '' : 's'}.`,
      detail: `${healthy} healthy checks, ${unsupported} unsupported checks.`,
      href: '/settings?tab=credentials',
    };
  }

  if (unsupported > 0 || healthy === 0) {
    return {
      id: 'providers',
      label: 'Integrations',
      level: 'review',
      summary: healthy === 0 ? 'No validated provider checks yet.' : `${unsupported} provider check${unsupported === 1 ? '' : 's'} need manual review.`,
      detail: `${healthy} healthy checks are available.`,
      href: '/settings?tab=credentials',
    };
  }

  return {
    id: 'providers',
    label: 'Integrations',
    level: 'healthy',
    summary: `${healthy} provider health check${healthy === 1 ? '' : 's'} passed.`,
    detail: 'SCM, registry, secrets, and identity dependencies are responding.',
    href: '/settings?tab=credentials',
  };
};

const buildWorkerLane = (workerPools: WorkerPool[]): OperatorHealthLane => {
  if (workerPools.length === 0) {
    return {
      id: 'workers',
      label: 'Worker pools',
      level: 'degraded',
      summary: 'No worker pools are available.',
      detail: 'Releasea needs at least one healthy worker path before production delivery is trustworthy.',
      href: '/workers',
    };
  }

  const degraded = workerPools.filter((pool) => pool.capacityState === 'degraded' || pool.capacityState === 'unavailable');
  const constrained = workerPools.filter((pool) => pool.capacityState === 'constrained' || pool.capacityState === 'bootstrap' || pool.capacityState === 'draining' || pool.capacityState === 'maintenance');
  const healthy = workerPools.filter((pool) => pool.capacityState === 'ready');
  const hot = workerPools.filter((pool) => pool.saturationState === 'hot' || pool.saturationState === 'saturated');
  const onlineWorkers = workerPools.reduce((sum, pool) => sum + pool.onlineWorkers + pool.busyWorkers, 0);

  if (degraded.length > 0 || onlineWorkers === 0) {
    return {
      id: 'workers',
      label: 'Worker pools',
      level: 'degraded',
      summary: degraded.length > 0 ? `${degraded.length} pool${degraded.length === 1 ? '' : 's'} degraded or unavailable.` : 'No online workers available.',
      detail: `${healthy.length} ready pools, ${constrained.length} constrained pools, ${hot.length} hot pools.`,
      href: '/workers',
    };
  }

  if (constrained.length > 0 || hot.length > 0) {
    return {
      id: 'workers',
      label: 'Worker pools',
      level: 'review',
      summary: hot.length > 0
        ? `${hot.length} pool${hot.length === 1 ? '' : 's'} are hot or saturated.`
        : `${constrained.length} pool${constrained.length === 1 ? '' : 's'} running with reduced capacity.`,
      detail: `${healthy.length} ready pools, ${constrained.length} constrained pools, ${onlineWorkers} online or busy workers.`,
      href: '/workers',
    };
  }

  return {
    id: 'workers',
    label: 'Worker pools',
    level: 'healthy',
    summary: `${healthy.length} pool${healthy.length === 1 ? '' : 's'} ready for routing.`,
    detail: `${onlineWorkers} online or busy workers across active pools.`,
    href: '/workers',
  };
};

const buildDeliveryLane = (deploys: Deploy[]): OperatorHealthLane => {
  const recentDeploys = [...deploys]
    .sort((left, right) => parseDeployTimestamp(right.startedAt, right.createdAt, right.updatedAt) - parseDeployTimestamp(left.startedAt, left.createdAt, left.updatedAt))
    .slice(0, 10);

  if (recentDeploys.length === 0) {
    return {
      id: 'delivery',
      label: 'Recent delivery',
      level: 'review',
      summary: 'No recent deploy signal is available.',
      detail: 'Complete at least one deploy to build a useful operator baseline.',
      href: '/services',
    };
  }

  const failed = recentDeploys.filter((deploy) => isFailedDeployStatus(deploy.status)).length;
  const live = recentDeploys.filter((deploy) => isLiveDeployStatus(deploy.status)).length;
  const successful = recentDeploys.filter((deploy) => isSuccessfulDeployStatus(deploy.status)).length;

  if (failed >= 3 || failed >= Math.ceil(recentDeploys.length / 2)) {
    return {
      id: 'delivery',
      label: 'Recent delivery',
      level: 'degraded',
      summary: `${failed} of the last ${recentDeploys.length} deploys failed or rolled back.`,
      detail: `${successful} completed successfully, ${live} still in progress.`,
      href: '/services',
    };
  }

  if (failed > 0 || live > 0) {
    return {
      id: 'delivery',
      label: 'Recent delivery',
      level: 'review',
      summary: failed > 0 ? `${failed} recent deploy failure${failed === 1 ? '' : 's'} need review.` : `${live} deploy${live === 1 ? '' : 's'} still running.`,
      detail: `${successful} successful deploys in the recent window.`,
      href: '/services',
    };
  }

  return {
    id: 'delivery',
    label: 'Recent delivery',
    level: 'healthy',
    summary: `${successful} recent deploy${successful === 1 ? '' : 's'} completed successfully.`,
    detail: 'No recent rollback or failure signal in the latest delivery window.',
    href: '/services',
  };
};
