import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiClient } from './api-client';

const jsonResponse = (status: number, data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('platform/http/client/api-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    apiClient.setToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds authorization and correlation id headers', async () => {
    apiClient.setToken('token-123');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { ok: true }));

    const response = await apiClient.get<{ ok: boolean }>('/teams');

    expect(response.error).toBeNull();
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const init = fetchSpy.mock.calls[0][1];
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('X-Correlation-ID')).toBeTruthy();
  });

  it('retries idempotent requests with backoff', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(503, { message: 'temporarily unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const response = await apiClient.get<{ ok: boolean }>('/workers', {
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(response.error).toBeNull();
    expect(response.data).toEqual({ ok: true });
  });

  it('does not retry non-idempotent requests by default', async () => {
    let csrfFetchCount = 0;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) {
          csrfFetchCount += 1;
          return jsonResponse(200, { csrfToken: 'csrf-token-1234567890' });
        }
        return jsonResponse(503, { message: 'temporarily unavailable' });
      });

    const response = await apiClient.post('/workers', { name: 'worker-1' }, {
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(csrfFetchCount).toBe(1);
    expect(response.status).toBe(503);
    expect(response.error).toBe('temporarily unavailable');
  });

  it('returns timeout error when request exceeds timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      });
    });

    const response = await apiClient.get('/slow-endpoint', {
      timeout: 5,
      retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    });

    expect(response.status).toBe(408);
    expect(response.error).toBe('Request timeout.');
    expect(response.errorDetails?.code).toBe('timeout');
  });

  it('refreshes token on 401 and retries original request once', async () => {
    apiClient.setToken('expired-token');

    let firstProtectedCall = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse(200, { csrfToken: 'csrf-token-1234567890' });
      }
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, { token: 'new-token' });
      }

      if (firstProtectedCall) {
        firstProtectedCall = false;
        return jsonResponse(401, { message: 'expired' });
      }

      return jsonResponse(200, { ok: true });
    });

    const response = await apiClient.get<{ ok: boolean }>('/services', {
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(response.status).toBe(200);
    expect(response.error).toBeNull();
    expect(response.data).toEqual({ ok: true });

    const retriedRequest = fetchSpy.mock.calls[3];
    const retryHeaders = new Headers(retriedRequest[1]?.headers as HeadersInit);
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-token');

    const refreshRequest = fetchSpy.mock.calls[2];
    expect(refreshRequest[1]?.credentials).toBe('include');
  });

  it('fails explicitly when request payload is outside contract', async () => {
    const response = await apiClient.post('/auth/login', { email: 'invalid-email', password: '' }, {
      requestSchema: z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    });

    expect(response.status).toBe(400);
    expect(response.error).toContain('outside contract');
    expect(response.errorDetails?.code).toBe('contract_error');
  });

  it('fails explicitly when response payload is outside contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { invalid: true }));

    const response = await apiClient.post('/auth/login', { email: 'user@example.com', password: 'pass123' }, {
      requestSchema: z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
      responseSchema: z.object({
        user: z.object({
          id: z.string().min(1),
        }),
        token: z.string().min(1),
      }),
    });

    expect(response.status).toBe(502);
    expect(response.error).toContain('outside contract');
    expect(response.errorDetails?.code).toBe('contract_error');
  });
});
