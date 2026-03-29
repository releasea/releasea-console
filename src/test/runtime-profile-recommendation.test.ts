import { describe, expect, it } from 'vitest';
import { recommendRuntimeProfile } from '@/pages/services/create-service/helpers';
import type { RuntimeProfile } from '@/types/runtime-profile';

const profiles: RuntimeProfile[] = [
  {
    id: 'rp-small',
    name: 'small',
    cpu: '250m',
    cpuLimit: '500m',
    memory: '256Mi',
    memoryLimit: '512Mi',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rp-medium',
    name: 'medium',
    cpu: '500m',
    cpuLimit: '1000m',
    memory: '512Mi',
    memoryLimit: '1024Mi',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rp-large',
    name: 'large',
    cpu: '1000m',
    cpuLimit: '2000m',
    memory: '1024Mi',
    memoryLimit: '2048Mi',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('recommendRuntimeProfile', () => {
  it('prefers the smallest stable profile for lightweight static sites', () => {
    const recommendation = recommendRuntimeProfile(profiles, {
      serviceType: 'static-site',
      templateKind: 'service',
      framework: 'vite',
    });

    expect(recommendation).toEqual(
      expect.objectContaining({
        profileId: 'rp-small',
        source: 'blueprint-default',
      }),
    );
  });

  it('prefers the balanced profile for services and apis', () => {
    const recommendation = recommendRuntimeProfile(profiles, {
      serviceType: 'microservice',
      templateKind: 'service',
    });

    expect(recommendation).toEqual(
      expect.objectContaining({
        profileId: 'rp-medium',
        source: 'blueprint-default',
      }),
    );
  });

  it('uses detected workload resources when they are available', () => {
    const recommendation = recommendRuntimeProfile(profiles, {
      serviceType: 'microservice',
      templateKind: 'service',
      cpuMilli: 500,
      memoryMi: 512,
    });

    expect(recommendation).toEqual(
      expect.objectContaining({
        profileId: 'rp-medium',
        source: 'detected-workload',
      }),
    );
  });
});
