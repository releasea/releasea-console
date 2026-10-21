import type { RulePolicyConfig } from '@/types/releasea';

export type EdgePolicyDraft = {
  timeoutMs: number;
  retries: number;
  ipPolicy: RulePolicyConfig['ipPolicy'];
  ipList: string;
  requiredHeaders: string;
  requiredScopes: string;
  apiKeyHeader: string;
  apiKeys: string;
  corsEnabled: boolean;
  corsOrigins: string;
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  circuitConsecutiveErrors: number;
  maxBodyBytes: number;
  securityHeaders: boolean;
  lockNetwork: boolean;
};

const splitList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const defaultEdgePolicyDraft = (): EdgePolicyDraft => ({
  timeoutMs: 1500,
  retries: 2,
  ipPolicy: 'open',
  ipList: '',
  requiredHeaders: '',
  requiredScopes: '',
  apiKeyHeader: 'x-api-key',
  apiKeys: '',
  corsEnabled: false,
  corsOrigins: '',
  rateLimitRequests: 0,
  rateLimitWindowSeconds: 60,
  circuitConsecutiveErrors: 0,
  maxBodyBytes: 0,
  securityHeaders: true,
  lockNetwork: false,
});

export function edgePolicyDraftFromRule(policy?: Partial<RulePolicyConfig> | null): EdgePolicyDraft {
  const defaults = defaultEdgePolicyDraft();
  if (!policy) return defaults;
  return {
    timeoutMs: policy.timeoutMs || defaults.timeoutMs,
    retries: policy.retries ?? defaults.retries,
    ipPolicy: policy.ipPolicy ?? 'open',
    ipList: (policy.ipList ?? []).join('\n'),
    requiredHeaders: (policy.requiredHeaders ?? []).join(', '),
    requiredScopes: (policy.requiredScopes ?? []).join(', '),
    apiKeyHeader: policy.apiKeyHeader || defaults.apiKeyHeader,
    apiKeys: (policy.apiKeys ?? []).join('\n'),
    corsEnabled: Boolean(policy.cors?.enabled),
    corsOrigins: (policy.cors?.origins ?? []).join(', '),
    rateLimitRequests: policy.rateLimit?.requests ?? 0,
    rateLimitWindowSeconds: policy.rateLimit?.windowSeconds || defaults.rateLimitWindowSeconds,
    circuitConsecutiveErrors: policy.circuitBreaker?.consecutiveErrors ?? 0,
    maxBodyBytes: policy.maxBodyBytes ?? 0,
    securityHeaders: policy.securityHeaders ?? true,
    lockNetwork: Boolean(policy.lockNetwork),
  };
}

export function edgePolicyFields(draft: EdgePolicyDraft): Omit<RulePolicyConfig, 'action' | 'authMode' | 'jwtIssuer' | 'jwksUri' | 'audiences'> {
  return {
    timeoutMs: Number(draft.timeoutMs) || 1500,
    retries: Number.isFinite(draft.retries) ? draft.retries : 2,
    ipPolicy: draft.ipPolicy,
    ipList: draft.ipPolicy === 'open' ? [] : splitList(draft.ipList),
    requiredHeaders: splitList(draft.requiredHeaders),
    requiredScopes: splitList(draft.requiredScopes),
    apiKeyHeader: draft.apiKeyHeader.trim() || 'x-api-key',
    apiKeys: splitList(draft.apiKeys),
    cors: {
      enabled: draft.corsEnabled,
      origins: splitList(draft.corsOrigins),
      maxAgeSeconds: 600,
    },
    rateLimit: {
      requests: Number(draft.rateLimitRequests) || 0,
      windowSeconds: Number(draft.rateLimitWindowSeconds) || 60,
    },
    circuitBreaker: {
      consecutiveErrors: Number(draft.circuitConsecutiveErrors) || 0,
    },
    maxBodyBytes: Number(draft.maxBodyBytes) || 0,
    securityHeaders: draft.securityHeaders,
    lockNetwork: draft.lockNetwork,
  };
}

export function edgePolicyError(
  action: RulePolicyConfig['action'],
  authMode: NonNullable<RulePolicyConfig['authMode']>,
  draft: EdgePolicyDraft,
): string | null {
  if (draft.timeoutMs < 100 || draft.timeoutMs > 60000) {
    return 'Timeout must be between 100 and 60000 milliseconds.';
  }
  if (draft.retries < 0 || draft.retries > 5) {
    return 'Retries must be between 0 and 5.';
  }
  if (action === 'allow' && draft.ipPolicy !== 'open' && splitList(draft.ipList).length === 0) {
    return 'Add at least one IP address or CIDR for the selected IP policy.';
  }
  if (action === 'allow' && authMode === 'apikey' && splitList(draft.apiKeys).length === 0) {
    return 'Add at least one API key of 8 or more characters.';
  }
  if ((draft.rateLimitRequests ?? 0) < 0) {
    return 'Rate limit cannot be negative.';
  }
  if ((draft.maxBodyBytes ?? 0) !== 0 && (draft.maxBodyBytes < 1024 || draft.maxBodyBytes > 10 * 1024 * 1024)) {
    return 'Max body size must be empty or between 1024 and 10485760 bytes.';
  }
  return null;
}
