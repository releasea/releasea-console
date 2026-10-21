import { describe, expect, it } from 'vitest';
import { buildOperatorHealthReport } from '@/lib/operator-health';

describe('buildOperatorHealthReport', () => {
  it('marks worker lane for review when a pool is hot or saturated', () => {
    const report = buildOperatorHealthReport({
      providerHealth: null,
      controlPlaneMetrics: null,
      deploys: [],
      workerPools: [
        {
          id: 'prod|cluster-a|releasea-apps|prod',
          status: 'busy',
          capacityState: 'ready',
          saturationState: 'hot',
          saturationPercent: 80,
          environment: 'prod',
          cluster: 'cluster-a',
          namespacePrefix: 'releasea-apps',
          tags: ['prod'],
          namespaces: ['releasea-apps-prod'],
          workerCount: 2,
          onlineWorkers: 1,
          busyWorkers: 1,
          offlineWorkers: 0,
          pendingWorkers: 0,
          registrationCount: 2,
          activeRegistrations: 2,
          pendingRegistrations: 0,
          inactiveRegistrations: 0,
          desiredAgents: 2,
          onlineAgents: 2,
          availableAgents: 1,
          capacityScore: 82,
        },
      ],
    });

    const workerLane = report.lanes.find((lane) => lane.id === 'workers');
    expect(workerLane?.level).toBe('review');
    expect(workerLane?.summary).toContain('hot');
  });

  it('marks control-plane lane degraded when dispatch failures are present', () => {
    const report = buildOperatorHealthReport({
      providerHealth: null,
      controlPlaneMetrics: {
        version: '1',
        queue: {
          queueName: 'releasea.worker',
          deadLetterEnabled: true,
          deadLetterQueueName: 'releasea.worker.dead-letter',
          queuedOperations: 2,
          dispatchingOperations: 0,
          dispatchFailedOperations: 1,
          staleQueuedOperations: 1,
          recentDispatchFailures: 1,
          status: 'degraded',
          summary: 'Dispatch failures need attention before the next platform change.',
        },
      },
      deploys: [],
      workerPools: [],
    });

    const lane = report.lanes.find((candidate) => candidate.id === 'control-plane');
    expect(lane?.level).toBe('degraded');
    expect(lane?.summary).toContain('Dispatch failures');
  });

  it('names the unhealthy integration instead of a bare count', () => {
    const report = buildOperatorHealthReport({
      providerHealth: {
        version: '1',
        scm: {
          kind: 'scm',
          healthy: 0,
          unhealthy: 1,
          checks: [
            {
              providerId: 'github',
              providerLabel: 'GitHub',
              resourceLabel: 'Platform GitHub',
              state: 'unhealthy',
              message: 'Token rejected.',
            },
          ],
        },
        registry: { kind: 'registry', healthy: 0, unhealthy: 0, checks: [] },
        secrets: { kind: 'secrets', healthy: 0, unhealthy: 0, checks: [] },
        identity: { kind: 'identity', healthy: 0, unhealthy: 0, checks: [] },
        notifications: { kind: 'notifications', healthy: 0, unhealthy: 0, checks: [] },
      },
      controlPlaneMetrics: null,
      deploys: [],
      workerPools: [],
    });

    const lane = report.lanes.find((candidate) => candidate.id === 'providers');
    expect(lane?.summary).toBe('Platform GitHub · GitHub is unhealthy.');
    expect(lane?.detail).toBe('Token rejected.');
    expect(lane?.href).toBe('/settings?tab=providers&focus=health');
  });
});
