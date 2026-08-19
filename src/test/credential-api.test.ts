import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    getToken: vi.fn(),
  },
}));

describe('credential API writes', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('does not fabricate an SCM credential when persistence fails', async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: 'Credential storage is unavailable',
      status: 503,
    });

    const { createScmCredential } = await import('@/lib/data');
    const result = await createScmCredential({
      name: 'GitHub platform token',
      provider: 'github',
      authType: 'token',
      scope: 'platform',
      token: 'test-token',
    });

    expect(result).toBeNull();
  });

  it('returns only the SCM credential persisted by the API', async () => {
    const persisted = {
      id: 'scm-1',
      name: 'GitHub platform token',
      provider: 'github',
      authType: 'token',
      scope: 'platform' as const,
      createdAt: '2026-08-19T00:00:00Z',
    };
    mockPost.mockResolvedValue({ data: persisted, error: null, status: 201 });

    const { createScmCredential } = await import('@/lib/data');
    const result = await createScmCredential({
      name: persisted.name,
      provider: persisted.provider,
      authType: persisted.authType,
      scope: persisted.scope,
      token: 'test-token',
    });

    expect(result).toEqual(persisted);
    expect(mockPost).toHaveBeenCalledWith('/credentials/scm', expect.objectContaining({
      name: persisted.name,
      token: 'test-token',
    }));
  });

  it('does not fabricate a registry credential when persistence fails', async () => {
    mockPost.mockResolvedValue({ data: null, error: 'Forbidden request', status: 403 });

    const { createRegistryCredential } = await import('@/lib/data');
    const result = await createRegistryCredential({
      name: 'Platform registry',
      provider: 'docker',
      registryUrl: 'registry.example.com',
      username: 'releasea',
      password: 'test-password',
      scope: 'platform',
    });

    expect(result).toBeNull();
  });
});
