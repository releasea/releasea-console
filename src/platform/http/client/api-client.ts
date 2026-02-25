import { AppConfig, getApiUrl } from '@/lib/config';
import { z, type ZodType } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  retry?: RetryOptions;
  idempotent?: boolean;
  requestSchema?: ZodType<unknown>;
  responseSchema?: ZodType<unknown>;
  requireCsrf?: boolean;
  idempotencyKey?: string;
}

export type ApiErrorCode =
  | 'aborted'
  | 'timeout'
  | 'network_error'
  | 'parse_error'
  | 'contract_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'server_error'
  | 'http_error';

export interface ApiErrorDetails {
  code: ApiErrorCode;
  correlationId: string;
  retryable: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  correlationId?: string;
  errorDetails?: ApiErrorDetails | null;
}

interface TokenRefreshResponse {
  token?: string;
  user?: unknown;
}

interface CSRFTokenResponse {
  csrfToken?: string;
}

const IDEMPOTENT_METHODS = new Set<HttpMethod>(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const SAFE_METHODS = new Set<HttpMethod>(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/password/reset',
  '/auth/password/reset/confirm',
  '/auth/sso/exchange',
  '/auth/csrf',
];
const IDEMPOTENCY_PROTECTED_ENDPOINTS = [/^\/services\/[^/]+\/deploys$/, /^\/services\/[^/]+\/promote-canary$/];
const csrfTokenResponseSchema = z.object({
  csrfToken: z.string().min(16),
});
const DEFAULT_RETRY: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 3_000,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const resolveBodyMessage = (data: unknown): string | null => {
  if (!isRecord(data)) {
    return null;
  }
  const message = data.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  const error = data.error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  const detail = data.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  return null;
};

const defaultStatusMessage = (status: number): string => {
  switch (status) {
    case 401:
      return 'Unauthorized request.';
    case 403:
      return 'Forbidden request.';
    case 404:
      return 'Resource not found.';
    case 409:
      return 'Request conflict.';
    case 429:
      return 'Too many requests. Please try again later.';
    default:
      if (status >= 500) {
        return 'Server error while processing request.';
      }
      return `Request failed with status ${status}.`;
  }
};

const mapStatusToCode = (status: number): ApiErrorCode => {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate_limited';
    default:
      if (status >= 500) {
        return 'server_error';
      }
      return 'http_error';
  }
};

const shouldRetryStatus = (status: number): boolean => {
  if (RETRYABLE_STATUSES.has(status)) {
    return true;
  }
  return status >= 500 && status <= 599;
};

const resolveMaxAttempts = (
  method: HttpMethod,
  idempotent: boolean | undefined,
  retry: RetryOptions | undefined,
  hasIdempotencyKey: boolean,
): number => {
  const safeToRetry = IDEMPOTENT_METHODS.has(method) || (idempotent === true && hasIdempotencyKey);
  if (!safeToRetry) {
    return 1;
  }
  return Math.max(1, retry?.maxAttempts ?? DEFAULT_RETRY.maxAttempts);
};

const resolveBackoff = (
  retry: RetryOptions | undefined,
): Required<Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'>> => ({
  baseDelayMs: Math.max(1, retry?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs),
  maxDelayMs: Math.max(1, retry?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs),
});

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const backoffDelayMs = (
  attempt: number,
  retry: Required<Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'>>,
): number => {
  const exponential = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(exponential * (Math.random() * 0.2));
  return exponential + jitter;
};

const generateCorrelationId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const serializeBody = (body: unknown): BodyInit | undefined => {
  if (body == null) {
    return undefined;
  }
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams
  ) {
    return body;
  }
  return JSON.stringify(body);
};

const normalizeEndpoint = (endpoint: string): string => endpoint.trim().toLowerCase();

const shouldUseCsrfForRequest = (
  method: HttpMethod,
  endpoint: string,
  forceCsrf?: boolean,
): boolean => {
  if (forceCsrf === true) {
    return true;
  }
  if (SAFE_METHODS.has(method)) {
    return false;
  }
  const normalized = normalizeEndpoint(endpoint);
  return !CSRF_EXCLUDED_PATHS.some((prefix) => normalized.startsWith(prefix));
};

const endpointRequiresIdempotency = (endpoint: string): boolean => {
  const normalized = normalizeEndpoint(endpoint);
  return IDEMPOTENCY_PROTECTED_ENDPOINTS.some((pattern) => pattern.test(normalized));
};

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!isRecord(value)) {
    return value;
  }
  const sortedKeys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const output: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    output[key] = sortObject(value[key]);
  }
  return output;
};

const stableJSONStringify = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  try {
    return JSON.stringify(sortObject(value));
  } catch {
    return String(value);
  }
};

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const isMutatingMethod = (method: HttpMethod): boolean => !SAFE_METHODS.has(method);

class ApiClient {
  private token: string | null = null;
  private sessionUser: unknown | null = null;
  private csrfToken: string | null = null;
  private csrfPromise: Promise<string | null> | null = null;
  private refreshingPromise: Promise<boolean> | null = null;
  private idempotencyKeyCache = new Map<string, { key: string; expiresAt: number }>();

  setToken(token: string | null): void {
    this.token = token;
    if (!token) {
      this.sessionUser = null;
      this.csrfToken = null;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async restoreSession<T = unknown>(): Promise<T | null> {
    const restored = await this.refreshToken();
    if (!restored) {
      return null;
    }
    return (this.sessionUser as T | null) ?? null;
  }

  private buildHeaders(
    correlationId: string,
    customHeaders?: Record<string, string>,
    body?: unknown,
    csrfToken?: string,
    idempotencyKey?: string,
  ): Headers {
    const headers = new Headers(customHeaders);
    headers.set('Accept', headers.get('Accept') || 'application/json');
    headers.set('X-Correlation-ID', correlationId);
    headers.set('X-Requested-With', headers.get('X-Requested-With') || 'XMLHttpRequest');

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (idempotencyKey && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', idempotencyKey);
    }

    const hasBody = body != null;
    const isFormData = body instanceof FormData;
    if (hasBody && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return headers;
  }

  private async parseResponseData(response: Response): Promise<unknown> {
    if (response.status === 204 || response.status === 205) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }

    const text = await response.text();
    return text.trim().length ? text : null;
  }

  private shouldAttemptTokenRefresh(endpoint: string): boolean {
    const normalized = normalizeEndpoint(endpoint);
    if (!this.token) {
      return false;
    }
    if (normalized.startsWith('/auth/login') || normalized.startsWith('/auth/signup')) {
      return false;
    }
    if (normalized.startsWith('/auth/refresh') || normalized.startsWith('/auth/logout')) {
      return false;
    }
    return true;
  }

  private validateRequestContract(
    endpoint: string,
    body: unknown,
    requestSchema?: ZodType<unknown>,
  ): ApiResponse<never> | null {
    if (!requestSchema) {
      return null;
    }
    const parsed = requestSchema.safeParse(body);
    if (parsed.success) {
      return null;
    }
    const correlationId = generateCorrelationId();
    return {
      data: null,
      error: `Request payload outside contract for ${endpoint}.`,
      status: 400,
      correlationId,
      errorDetails: {
        code: 'contract_error',
        correlationId,
        retryable: false,
      },
    };
  }

  private validateResponseContract<T>(
    endpoint: string,
    data: unknown,
    responseSchema: ZodType<unknown> | undefined,
    correlationId: string,
    _status: number,
  ): ApiResponse<T> | null {
    if (!responseSchema) {
      return null;
    }
    const parsed = responseSchema.safeParse(data);
    if (parsed.success) {
      return null;
    }
    return {
      data: null,
      error: `Response payload outside contract for ${endpoint}.`,
      status: 502,
      correlationId,
      errorDetails: {
        code: 'contract_error',
        correlationId,
        retryable: false,
      },
    };
  }

  private resolveIdempotencyKey(
    method: HttpMethod,
    endpoint: string,
    body: unknown,
    providedKey?: string,
  ): string | undefined {
    if (providedKey) {
      return providedKey;
    }
    if (!isMutatingMethod(method) || !endpointRequiresIdempotency(endpoint)) {
      return undefined;
    }
    const fingerprint = `${method}|${normalizeEndpoint(endpoint)}|${stableJSONStringify(body)}`;
    const now = Date.now();
    const cached = this.idempotencyKeyCache.get(fingerprint);
    if (cached && cached.expiresAt > now) {
      return cached.key;
    }
    const key = `idem-${fnv1a(fingerprint)}-${Math.floor(now / 1000)}`;
    this.idempotencyKeyCache.set(fingerprint, { key, expiresAt: now + 30_000 });
    return key;
  }

  private async ensureCsrfToken(): Promise<string | null> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    if (this.csrfPromise) {
      return this.csrfPromise;
    }

    this.csrfPromise = (async () => {
      const correlationId = generateCorrelationId();
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AppConfig.requestTimeout);
      try {
        const response = await fetch(getApiUrl('/auth/csrf'), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) {
          return null;
        }
        const payload = (await response.json()) as CSRFTokenResponse;
        const parsed = csrfTokenResponseSchema.safeParse(payload);
        if (!parsed.success) {
          return null;
        }
        this.csrfToken = parsed.data.csrfToken;
        return this.csrfToken;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timeoutId);
        this.csrfPromise = null;
      }
    })();

    return this.csrfPromise;
  }

  private normalizeHttpFailure(status: number, data: unknown, correlationId: string): ApiResponse<never> {
    return {
      data: null,
      error: resolveBodyMessage(data) || defaultStatusMessage(status),
      status,
      correlationId,
      errorDetails: {
        code: mapStatusToCode(status),
        correlationId,
        retryable: shouldRetryStatus(status),
      },
    };
  }

  private normalizeTransportFailure(
    error: unknown,
    timedOut: boolean,
    cancelled: boolean,
    correlationId: string,
  ): ApiResponse<never> {
    if (timedOut) {
      return {
        data: null,
        error: 'Request timeout.',
        status: 408,
        correlationId,
        errorDetails: {
          code: 'timeout',
          correlationId,
          retryable: true,
        },
      };
    }

    if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
      return {
        data: null,
        error: 'Request cancelled.',
        status: 499,
        correlationId,
        errorDetails: {
          code: 'aborted',
          correlationId,
          retryable: false,
        },
      };
    }

    const message = error instanceof Error ? error.message : 'Network error.';
    return {
      data: null,
      error: message,
      status: 0,
      correlationId,
      errorDetails: {
        code: 'network_error',
        correlationId,
        retryable: true,
      },
    };
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    allowRefresh = true,
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers: customHeaders,
      timeout = AppConfig.requestTimeout,
      signal: externalSignal,
      retry,
      idempotent,
      requestSchema,
      responseSchema,
      requireCsrf,
      idempotencyKey: providedIdempotencyKey,
    } = options;

    const requestContractError = this.validateRequestContract(endpoint, body, requestSchema);
    if (requestContractError) {
      return requestContractError as ApiResponse<T>;
    }

    const idempotencyKey = this.resolveIdempotencyKey(method, endpoint, body, providedIdempotencyKey);
    const maxAttempts = resolveMaxAttempts(method, idempotent, retry, Boolean(idempotencyKey));
    const retryConfig = resolveBackoff(retry);
    const csrfRequired = shouldUseCsrfForRequest(method, endpoint, requireCsrf);
    const csrfToken = csrfRequired ? await this.ensureCsrfToken() : null;
    if (csrfRequired && !csrfToken) {
      const correlationId = generateCorrelationId();
      return {
        data: null,
        error: 'Unable to validate request CSRF token.',
        status: 403,
        correlationId,
        errorDetails: {
          code: 'forbidden',
          correlationId,
          retryable: false,
        },
      };
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const correlationId = generateCorrelationId();
      const controller = new AbortController();
      let timedOut = false;
      let cancelled = false;

      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);

      let detachExternalAbort = () => {};
      if (externalSignal) {
        const onAbort = () => {
          cancelled = true;
          controller.abort();
        };
        if (externalSignal.aborted) {
          onAbort();
        } else {
          externalSignal.addEventListener('abort', onAbort, { once: true });
          detachExternalAbort = () => externalSignal.removeEventListener('abort', onAbort);
        }
      }

      try {
        const response = await fetch(getApiUrl(endpoint), {
          method,
          headers: this.buildHeaders(correlationId, customHeaders, body, csrfToken ?? undefined, idempotencyKey),
          body: serializeBody(body),
          credentials: 'include',
          signal: controller.signal,
        });

        const data = await this.parseResponseData(response);

        if (
          response.status === 401 &&
          allowRefresh &&
          this.shouldAttemptTokenRefresh(endpoint)
        ) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            return this.request<T>(endpoint, options, false);
          }
        }

        if (response.ok) {
          const responseContractError = this.validateResponseContract<T>(
            endpoint,
            data,
            responseSchema,
            correlationId,
            response.status,
          );
          if (responseContractError) {
            return responseContractError;
          }
          return {
            data: data as T,
            error: null,
            status: response.status,
            correlationId,
            errorDetails: null,
          };
        }

        const normalizedError = this.normalizeHttpFailure(response.status, data, correlationId);
        const canRetry = attempt < maxAttempts && normalizedError.errorDetails?.retryable === true;
        if (!canRetry) {
          return normalizedError as ApiResponse<T>;
        }
      } catch (error) {
        const normalizedError = this.normalizeTransportFailure(error, timedOut, cancelled, correlationId);
        const canRetry = attempt < maxAttempts && normalizedError.errorDetails?.retryable === true;
        if (!canRetry) {
          return normalizedError as ApiResponse<T>;
        }
      } finally {
        window.clearTimeout(timeoutId);
        detachExternalAbort();
      }

      try {
        const delay = backoffDelayMs(attempt, retryConfig);
        await wait(delay, externalSignal);
      } catch {
        const correlationId = generateCorrelationId();
        return {
          data: null,
          error: 'Request cancelled.',
          status: 499,
          correlationId,
          errorDetails: {
            code: 'aborted',
            correlationId,
            retryable: false,
          },
        };
      }
    }

    const correlationId = generateCorrelationId();
    return {
      data: null,
      error: 'Request failed.',
      status: 0,
      correlationId,
      errorDetails: {
        code: 'network_error',
        correlationId,
        retryable: false,
      },
    };
  }

  async get<T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  private async refreshToken(): Promise<boolean> {
    if (this.refreshingPromise) {
      return this.refreshingPromise;
    }

    this.refreshingPromise = (async () => {
      const correlationId = generateCorrelationId();
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AppConfig.requestTimeout);

      try {
        const csrfToken = await this.ensureCsrfToken();
        if (!csrfToken) {
          this.clearAuthStorage();
          return false;
        }
        const response = await fetch(getApiUrl('/auth/refresh'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          this.clearAuthStorage();
          return false;
        }

        const payload = (await response.json()) as TokenRefreshResponse;
        if (!payload.token) {
          this.clearAuthStorage();
          return false;
        }

        this.setToken(payload.token);
        this.sessionUser = payload.user ?? null;
        return true;
      } catch {
        this.clearAuthStorage();
        return false;
      } finally {
        window.clearTimeout(timeoutId);
        this.refreshingPromise = null;
      }
    })();

    return this.refreshingPromise;
  }

  private clearAuthStorage(): void {
    this.setToken(null);
    this.sessionUser = null;
    this.csrfToken = null;
    // Legacy cleanup for previous browser-storage auth strategy.
    localStorage.removeItem('releasea_auth_token');
    localStorage.removeItem('releasea_refresh_token');
    localStorage.removeItem('releasea_auth_user');
    localStorage.removeItem('releasea_reset_token');
  }
}

export const apiClient = new ApiClient();
