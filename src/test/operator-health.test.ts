import { describe, expect, it } from 'vitest';
import { buildOperatorHealthReport } from '@/lib/operator-health';

describe('buildOperatorHealthReport', () => {
  it('marks worker lane for review when a pool is hot or saturated', () => {
    const report = buildOperatorHealthReport({
      providerHealth: null,
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
});
