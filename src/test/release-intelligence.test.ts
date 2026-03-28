import { describe, expect, it } from 'vitest';

import { buildReleaseIntelligenceSummary } from '@/lib/release-intelligence';
import type { Deploy, Metrics } from '@/types/releasea';

describe('buildReleaseIntelligenceSummary', () => {
  it('builds a stable release summary when latency and errors stay within target', () => {
    const deploys: Deploy[] = [
      {
        id: 'dep-2',
        serviceId: 'svc-1',
        status: 'completed',
        commit: 'abcdef1234567890',
        triggeredBy: 'admin',
        startedAt: '2026-03-28T12:10:00Z',
        logs: [],
      },
      {
        id: 'dep-1',
        serviceId: 'svc-1',
        status: 'completed',
        commit: '123456abcdef7890',
        triggeredBy: 'admin',
        startedAt: '2026-03-28T11:40:00Z',
        logs: [],
      },
    ];

    const metrics: Metrics = {
      serviceId: 'svc-1',
      environment: 'prod',
      timestamps: [
        '2026-03-28T12:00:00Z',
        '2026-03-28T12:05:00Z',
        '2026-03-28T12:10:00Z',
        '2026-03-28T12:15:00Z',
        '2026-03-28T12:20:00Z',
      ],
      cpu: [50, 52, 55, 54, 53],
      memory: [45, 46, 47, 48, 49],
      latencyP95: [140, 150, 155, 160, 158],
      requests: [120, 118, 122, 119, 121],
      statusCodes: {
        '2xx': [100, 100, 100, 100, 100],
        '4xx': [2, 2, 2, 2, 2],
        '5xx': [0, 0, 0, 0, 0],
      },
    };

    const summary = buildReleaseIntelligenceSummary(deploys, metrics);

    expect(summary).not.toBeNull();
    expect(summary?.latestReleaseLabel).toBe('abcdef123456');
    expect(summary?.previousReleaseLabel).toBe('123456abcdef');
    expect(summary?.slo.overallState).toBe('meeting');
    expect(summary?.baseline.available).toBe(true);
    expect(summary?.rollback.recommendation).toBe('stable');
  });

  it('recommends rollback when post-deploy latency and errors regress sharply', () => {
    const deploys: Deploy[] = [
      {
        id: 'dep-2',
        serviceId: 'svc-1',
        status: 'completed',
        commit: 'feedfacecafebeef',
        triggeredBy: 'admin',
        startedAt: '2026-03-28T12:10:00Z',
        logs: [],
      },
    ];

    const metrics: Metrics = {
      serviceId: 'svc-1',
      environment: 'prod',
      timestamps: [
        '2026-03-28T12:00:00Z',
        '2026-03-28T12:05:00Z',
        '2026-03-28T12:10:00Z',
        '2026-03-28T12:15:00Z',
        '2026-03-28T12:20:00Z',
      ],
      cpu: [50, 52, 60, 62, 64],
      memory: [45, 46, 47, 48, 49],
      latencyP95: [120, 130, 260, 300, 320],
      requests: [140, 142, 138, 144, 145],
      statusCodes: {
        '2xx': [100, 100, 95, 92, 90],
        '4xx': [2, 2, 2, 2, 2],
        '5xx': [0, 0, 4, 6, 8],
      },
    };

    const summary = buildReleaseIntelligenceSummary(deploys, metrics);

    expect(summary).not.toBeNull();
    expect(summary?.baseline.available).toBe(true);
    expect(summary?.baseline.latencyChangePct).toBeGreaterThan(50);
    expect(summary?.rollback.recommendation).toBe('rollback');
    expect(summary?.slo.overallState).toBe('breached');
  });
});
