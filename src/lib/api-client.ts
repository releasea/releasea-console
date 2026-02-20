import { AppConfig, getApiUrl } from './config';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

interface TokenRefreshResponse {
  token?: string;
  refreshToken?: string;
  user?: unknown;
}

class ApiClient {
  private token: string | null = null;
  private refreshingPromise: Promise<boolean> | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...customHeaders,
    });

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}, allowRefresh = true): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers: customHeaders, timeout = AppConfig.requestTimeout } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(getApiUrl(endpoint), {
        method,
        headers: this.getHeaders(customHeaders),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const hasBody = response.status !== 204 && response.status !== 205;
      const data = hasBody && contentType.includes('application/json')
        ? await response.json()
        : null;

      if (
        response.status === 401 &&
        allowRefresh &&
        this.shouldAttemptTokenRefresh(endpoint)
      ) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          clearTimeout(timeoutId);
          return this.request<T>(endpoint, options, false);
        }
      }

      if (!response.ok) {
        return {
          data: null,
          error: data.message || `Request failed with status ${response.status}`,
          status: response.status,
        };
      }

      return {
        data,
        error: null,
        status: response.status,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return {
            data: null,
            error: 'Request timeout',
            status: 408,
          };
        }
        return {
          data: null,
          error: err.message,
          status: 0,
        };
      }
      
      return {
        data: null,
        error: 'Unknown error occurred',
        status: 0,
      };
    }
  }

  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  private shouldAttemptTokenRefresh(endpoint: string): boolean {
    const normalized = endpoint.trim().toLowerCase();
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

  private async refreshToken(): Promise<boolean> {
    if (this.refreshingPromise) {
      return this.refreshingPromise;
    }
    const refreshToken = localStorage.getItem('releasea_refresh_token');
    if (!refreshToken) {
      return false;
    }

    this.refreshingPromise = (async () => {
      try {
        const response = await fetch(getApiUrl('/auth/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
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
        localStorage.setItem('releasea_auth_token', payload.token);
        if (payload.refreshToken) {
          localStorage.setItem('releasea_refresh_token', payload.refreshToken);
        }
        if (payload.user) {
          localStorage.setItem('releasea_auth_user', JSON.stringify(payload.user));
        }
        return true;
      } catch {
        this.clearAuthStorage();
        return false;
      } finally {
        this.refreshingPromise = null;
      }
    })();

    return this.refreshingPromise;
  }

  private clearAuthStorage(): void {
    this.setToken(null);
    localStorage.removeItem('releasea_auth_token');
    localStorage.removeItem('releasea_refresh_token');
    localStorage.removeItem('releasea_auth_user');
  }
}

export const apiClient = new ApiClient();
