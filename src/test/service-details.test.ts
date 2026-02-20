import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the data layer functions for correct parameter handling
describe('fetchMetrics parameter validation', () => {
  it('should require environment parameter', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Dynamically import to test the function
    const { fetchMetrics } = await import('@/lib/data');

    const result = await fetchMetrics('svc-1', new Date(), new Date());
    // Without environment, should return zeros and warn
    expect(result.cpu.every((v: number) => v === 0)).toBe(true);
    expect(result.memory.every((v: number) => v === 0)).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should include environment in API endpoint', async () => {
    const { fetchMetrics } = await import('@/lib/data');

    // Mock the API client to capture the endpoint
    const apiClient = await import('@/lib/api-client');
    const getSpy = vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      data: {
        serviceId: 'svc-1',
        environment: 'prod',
        timestamps: [],
        cpu: [],
        memory: [],
        latencyP95: [],
        requests: [],
      },
      error: null,
      status: 200,
    });

    await fetchMetrics('svc-1', new Date('2024-01-01'), new Date('2024-01-02'), 'prod');

    expect(getSpy).toHaveBeenCalled();
    const endpoint = getSpy.mock.calls[0][0] as string;
    expect(endpoint).toContain('environment=prod');
    expect(endpoint).toContain('/services/svc-1/metrics');

    getSpy.mockRestore();
  });
});

describe('fetchServiceLogs parameter validation', () => {
  it('should require environment parameter', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { fetchServiceLogs } = await import('@/lib/data');
    const result = await fetchServiceLogs('svc-1', {});
    expect(result).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('should include environment and pod in endpoint', async () => {
    const { fetchServiceLogs } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const getSpy = vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      data: [],
      error: null,
      status: 200,
    });

    await fetchServiceLogs('svc-1', {
      environment: 'staging',
      pod: 'my-service-abc123',
      limit: 100,
    });

    expect(getSpy).toHaveBeenCalled();
    const endpoint = getSpy.mock.calls[0][0] as string;
    expect(endpoint).toContain('environment=staging');
    expect(endpoint).toContain('pod=my-service-abc123');
    expect(endpoint).toContain('limit=100');

    getSpy.mockRestore();
  });
});

describe('fetchServicePods parameter validation', () => {
  it('should require environment parameter', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { fetchServicePods } = await import('@/lib/data');
    const result = await fetchServicePods('svc-1', '');
    expect(result).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('should include environment in endpoint', async () => {
    const { fetchServicePods } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const getSpy = vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      data: { pods: ['my-pod-1', 'my-pod-2'], namespace: 'releasea-apps-production' },
      error: null,
      status: 200,
    });

    const pods = await fetchServicePods('svc-1', 'prod');

    expect(getSpy).toHaveBeenCalled();
    const endpoint = getSpy.mock.calls[0][0] as string;
    expect(endpoint).toContain('environment=prod');
    expect(pods).toEqual(['my-pod-1', 'my-pod-2']);

    getSpy.mockRestore();
  });
});

describe('performAction for rule publish', () => {
  it('should include environment in publish payload', async () => {
    const { performAction } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const postSpy = vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      data: { operation: { id: 'op-1' } },
      error: null,
      status: 202,
    });

    const success = await performAction({
      endpoint: '/rules/rule-1/publish',
      method: 'POST',
      payload: { internal: true, external: false, environment: 'staging' },
      label: 'publishRule',
    });

    expect(success).toBe(true);
    expect(postSpy).toHaveBeenCalledWith(
      '/rules/rule-1/publish',
      { internal: true, external: false, environment: 'staging' },
    );

    postSpy.mockRestore();
  });
});

describe('rule CRUD via API', () => {
  it('createRule sends POST /services/:id/rules with payload', async () => {
    const { createRule } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const postSpy = vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      data: {
        id: 'rule-new-1',
        name: 'test-rule',
        serviceId: 'svc-1',
        environment: 'prod',
        status: 'draft',
      },
      error: null,
      status: 200,
    });

    const result = await createRule({
      name: 'test-rule',
      serviceId: 'svc-1',
      environment: 'prod' as any,
      paths: ['/api'],
      methods: ['GET', 'POST'],
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('rule-new-1');
    expect(postSpy).toHaveBeenCalledWith('/services/svc-1/rules', expect.objectContaining({
      name: 'test-rule',
      serviceId: 'svc-1',
    }));

    postSpy.mockRestore();
  });

  it('createRule returns null on API failure', async () => {
    const { createRule } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const postSpy = vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      data: null,
      error: 'Server error',
      status: 500,
    });

    const result = await createRule({ name: 'fail-rule', serviceId: 'svc-1' });
    expect(result).toBeNull();

    postSpy.mockRestore();
  });

  it('updateRule sends PUT /rules/:id with payload', async () => {
    const { updateRule } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const putSpy = vi.spyOn(apiClient.apiClient, 'put').mockResolvedValue({
      data: {
        id: 'rule-1',
        name: 'updated-rule',
        paths: ['/v2'],
        methods: ['GET'],
      },
      error: null,
      status: 200,
    });

    const result = await updateRule('rule-1', {
      name: 'updated-rule',
      paths: ['/v2'],
      methods: ['GET'],
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBe('updated-rule');
    expect(putSpy).toHaveBeenCalledWith('/rules/rule-1', expect.objectContaining({
      name: 'updated-rule',
    }));

    putSpy.mockRestore();
  });

  it('deleteRule sends DELETE /rules/:id', async () => {
    const { deleteRule } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const deleteSpy = vi.spyOn(apiClient.apiClient, 'delete').mockResolvedValue({
      data: null,
      error: null,
      status: 204,
    });

    const result = await deleteRule('rule-1');
    expect(result).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith('/rules/rule-1');

    deleteSpy.mockRestore();
  });
});

describe('fetchRuleDeploys', () => {
  it('fetches from /rule-deploys endpoint', async () => {
    const { fetchRuleDeploys } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const getSpy = vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      data: [
        { id: 'rd-1', ruleId: 'rule-1', serviceId: 'svc-1', status: 'success', triggeredBy: 'admin', startedAt: '2024-01-01T00:00:00Z', logs: [] },
        { id: 'rd-2', ruleId: 'rule-2', serviceId: 'svc-1', status: 'queued', triggeredBy: 'admin', startedAt: '2024-01-02T00:00:00Z', logs: [] },
      ],
      error: null,
      status: 200,
    });

    const result = await fetchRuleDeploys();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('rd-1');
    expect(result[1].status).toBe('queued');
    expect(getSpy).toHaveBeenCalledWith('/rule-deploys', expect.anything());

    getSpy.mockRestore();
  });

  it('returns empty array on API failure', async () => {
    const { fetchRuleDeploys } = await import('@/lib/data');

    const apiClient = await import('@/lib/api-client');
    const getSpy = vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      data: null,
      error: 'Server error',
      status: 500,
    });

    const result = await fetchRuleDeploys();
    expect(result).toEqual([]);

    getSpy.mockRestore();
  });
});
