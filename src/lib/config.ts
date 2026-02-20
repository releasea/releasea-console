// Application configuration
const defaultApiBaseUrl = import.meta.env.DEV
  ? 'http://localhost:8070/api'
  : 'https://api.releasea.dev';

const rawApiBaseUrl = import.meta.env.RELEASEA_API_BASE_URL || defaultApiBaseUrl;
const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');

export const AppConfig = {
  // API base URL (used for all requests)
  apiBaseUrl: normalizedApiBaseUrl,

  // API version
  apiVersion: 'v1',

  // Request timeout in milliseconds
  requestTimeout: 30000,
  // List/request timeout in milliseconds
  listRequestTimeout: 15000,

  // Enable debug logging
  debug: import.meta.env.DEV,
};

export const getApiUrl = (endpoint: string): string => {
  return `${AppConfig.apiBaseUrl}/${AppConfig.apiVersion}${endpoint}`;
};
