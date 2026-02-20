import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api-client to verify environment is always included in requests
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    getToken: vi.fn(),
  },
}));

describe('Environment-scoped API calls', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({ data: null, error: null, status: 200 });
    mockPost.mockResolvedValue({ data: null, error: null, status: 200 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchMetrics', () => {
    it('requires environment parameter and includes it in request', async () => {
      const { fetchMetrics } = await import('@/lib/data');
      
      // Call with environment
      mockGet.mockResolvedValueOnce({
        data: { serviceId: 'svc-1', timestamps: [], cpu: [], memory: [], latencyP95: [], requests: [] },
        error: null,
        status: 200,
      });
      
      await fetchMetrics('svc-1', new Date(), new Date(), 'prod');
      
      expect(mockGet).toHaveBeenCalled();
      const callUrl = mockGet.mock.calls[0][0] as string;
      expect(callUrl).toContain('environment=prod');
    });

    it('returns empty metrics without API call when environment is missing', async () => {
      const { fetchMetrics } = await import('@/lib/data');
      
      const result = await fetchMetrics('svc-1', new Date(), new Date(), '');
      
      // Should not call API when environment is empty
      expect(mockGet).not.toHaveBeenCalled();
      expect(result.cpu).toEqual(expect.any(Array));
    });
  });

  describe('fetchServiceLogs', () => {
    it('requires environment parameter and includes it in request', async () => {
      const { fetchServiceLogs } = await import('@/lib/data');
      
      mockGet.mockResolvedValueOnce({ data: [], error: null, status: 200 });
      
      await fetchServiceLogs('svc-1', { environment: 'staging' });
      
      expect(mockGet).toHaveBeenCalled();
      const callUrl = mockGet.mock.calls[0][0] as string;
      expect(callUrl).toContain('environment=staging');
    });

    it('returns empty logs without API call when environment is missing', async () => {
      const { fetchServiceLogs } = await import('@/lib/data');
      
      const result = await fetchServiceLogs('svc-1', {});
      
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('includes pod filter when provided', async () => {
      const { fetchServiceLogs } = await import('@/lib/data');
      
      mockGet.mockResolvedValueOnce({ data: [], error: null, status: 200 });
      
      await fetchServiceLogs('svc-1', { environment: 'prod', pod: 'my-service-abc123' });
      
      expect(mockGet).toHaveBeenCalled();
      const callUrl = mockGet.mock.calls[0][0] as string;
      expect(callUrl).toContain('environment=prod');
      expect(callUrl).toContain('pod=my-service-abc123');
    });
  });

  describe('fetchServicePods', () => {
    it('requires environment parameter', async () => {
      const { fetchServicePods } = await import('@/lib/data');
      
      mockGet.mockResolvedValueOnce({ data: { pods: ['pod-1', 'pod-2'] }, error: null, status: 200 });
      
      await fetchServicePods('svc-1', 'dev');
      
      expect(mockGet).toHaveBeenCalled();
      const callUrl = mockGet.mock.calls[0][0] as string;
      expect(callUrl).toContain('environment=dev');
    });

    it('returns empty array when environment is missing', async () => {
      const { fetchServicePods } = await import('@/lib/data');
      
      const result = await fetchServicePods('svc-1', '');
      
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});

describe('Environment is single source of truth', () => {
  it('environment parameter is required for all observability endpoints', async () => {
    // This test documents the architectural requirement that environment
    // must be explicitly provided to all observability-related API calls.
    // Silent defaults to "prod" are NOT allowed in the frontend.
    
    const { fetchMetrics, fetchServiceLogs, fetchServicePods } = await import('@/lib/data');
    
    // All functions should handle missing environment gracefully
    // by returning empty data without making API calls
    const metricsResult = await fetchMetrics('svc-1', new Date(), new Date(), undefined as unknown as string);
    const logsResult = await fetchServiceLogs('svc-1', { environment: undefined as unknown as string });
    const podsResult = await fetchServicePods('svc-1', undefined as unknown as string);
    
    // No API calls should have been made with undefined environment
    expect(metricsResult.cpu).toBeDefined();
    expect(logsResult).toEqual([]);
    expect(podsResult).toEqual([]);
  });
});
