import type {
  ApprovalRequest,
  ApprovalStatus,
  AuditLogEntry,
  GovernancePolicyDocument,
  GovernanceSettings,
  GovernanceTemporaryException,
  GovernanceTemporaryExceptionInput,
} from '@/types/governance';
import { apiClient } from '@/lib/api-client';

const EMPTY_GOVERNANCE_SETTINGS: GovernanceSettings = {
  deployApproval: {
    enabled: false,
    environments: [],
    minApprovers: 1,
  },
  deployPolicy: {
    enabled: false,
    dryRun: false,
    rules: [],
  },
  rulePublishApproval: {
    enabled: false,
    externalOnly: false,
    minApprovers: 1,
  },
  auditRetentionDays: 30,
};

const normalizeGovernanceSettings = (settings?: GovernanceSettings | null): GovernanceSettings => {
  if (!settings) {
    return EMPTY_GOVERNANCE_SETTINGS;
  }
  return {
    ...EMPTY_GOVERNANCE_SETTINGS,
    ...settings,
    deployApproval: {
      ...EMPTY_GOVERNANCE_SETTINGS.deployApproval,
      ...settings.deployApproval,
    },
    deployPolicy: {
      ...EMPTY_GOVERNANCE_SETTINGS.deployPolicy,
      ...settings.deployPolicy,
      dryRun: settings.deployPolicy?.dryRun ?? false,
      rules: (settings.deployPolicy?.rules ?? []).map((rule) => ({
        environment: rule.environment ?? '',
        allowAutoDeploy: rule.allowAutoDeploy ?? false,
        requireExplicitVersion: rule.requireExplicitVersion ?? false,
        blockExternalExposure: rule.blockExternalExposure ?? false,
        allowedProfileIds: rule.allowedProfileIds ?? [],
        allowedScmProviders: rule.allowedScmProviders ?? [],
        allowedRegistryProviders: rule.allowedRegistryProviders ?? [],
        allowedSecretProviders: rule.allowedSecretProviders ?? [],
        allowedSourceTypes: rule.allowedSourceTypes ?? [],
        allowedRegistries: rule.allowedRegistries ?? [],
        allowedStrategies: rule.allowedStrategies ?? [],
        maxReplicas: rule.maxReplicas ?? 0,
      })),
    },
    rulePublishApproval: {
      ...EMPTY_GOVERNANCE_SETTINGS.rulePublishApproval,
      ...settings.rulePublishApproval,
    },
  };
};

const normalizeAuditLogEntry = (entry: Partial<AuditLogEntry> & Record<string, unknown>): AuditLogEntry => ({
  id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : `audit-${Math.random().toString(16).slice(2)}`,
  action: typeof entry.action === 'string' && entry.action.trim() ? entry.action : 'unknown.action',
  resourceType: typeof entry.resourceType === 'string' && entry.resourceType.trim()
    ? entry.resourceType
    : 'settings',
  resourceId: typeof entry.resourceId === 'string' ? entry.resourceId : '',
  resourceName:
    typeof entry.resourceName === 'string' && entry.resourceName.trim()
      ? entry.resourceName
      : typeof entry.metadata === 'object' && entry.metadata && 'name' in entry.metadata && typeof entry.metadata.name === 'string' && entry.metadata.name.trim()
        ? entry.metadata.name
        : typeof entry.resourceId === 'string' && entry.resourceId.trim()
          ? entry.resourceId
          : 'Unknown resource',
  performedBy: {
    id: typeof entry.performedBy === 'object' && entry.performedBy && 'id' in entry.performedBy && typeof entry.performedBy.id === 'string'
      ? entry.performedBy.id
      : typeof entry.actor === 'object' && entry.actor && 'id' in entry.actor && typeof entry.actor.id === 'string'
        ? entry.actor.id
      : 'system',
    name: typeof entry.performedBy === 'object' && entry.performedBy && 'name' in entry.performedBy && typeof entry.performedBy.name === 'string'
      ? entry.performedBy.name
      : typeof entry.actor === 'object' && entry.actor && 'name' in entry.actor && typeof entry.actor.name === 'string'
        ? entry.actor.name
      : 'System',
    email: typeof entry.performedBy === 'object' && entry.performedBy && 'email' in entry.performedBy && typeof entry.performedBy.email === 'string'
      ? entry.performedBy.email
      : '',
  },
  performedAt:
    typeof entry.performedAt === 'string' && entry.performedAt.trim()
      ? entry.performedAt
      : typeof entry.createdAt === 'string' && entry.createdAt.trim()
        ? entry.createdAt
        : new Date(0).toISOString(),
  details: (() => {
    const details: Record<string, unknown> = {};
    if (entry.metadata && typeof entry.metadata === 'object') {
      Object.assign(details, entry.metadata as Record<string, unknown>);
    }
    if (entry.details && typeof entry.details === 'object') {
      Object.assign(details, entry.details as Record<string, unknown>);
    }
    if (typeof entry.status === 'string' && entry.status.trim()) {
      details.status = entry.status;
    }
    if (typeof entry.source === 'string' && entry.source.trim()) {
      details.source = entry.source;
    }
    if (typeof entry.message === 'string' && entry.message.trim()) {
      details.message = entry.message;
    }
    return Object.keys(details).length > 0 ? details : undefined;
  })(),
  ipAddress: typeof entry.ipAddress === 'string' ? entry.ipAddress : undefined,
});

const normalizeGovernanceTemporaryException = (
  item?: Partial<GovernanceTemporaryException> | null,
): GovernanceTemporaryException => ({
  id: item?.id?.trim() || `gexc-${Math.random().toString(16).slice(2)}`,
  policy: item?.policy?.trim() || 'deploy-policy',
  serviceId: item?.serviceId?.trim() || '',
  serviceName: item?.serviceName?.trim() || 'Unknown service',
  environment: item?.environment?.trim() || 'prod',
  codes: Array.isArray(item?.codes) && item?.codes.length > 0 ? item.codes.filter(Boolean) : ['*'],
  reason: item?.reason?.trim() || '',
  expiresAt: item?.expiresAt?.trim() || new Date(0).toISOString(),
  status: item?.status?.trim() || 'expired',
  createdAt: item?.createdAt?.trim() || new Date(0).toISOString(),
  createdBy: item?.createdBy,
  revokedAt: item?.revokedAt?.trim() || undefined,
  revokedBy: item?.revokedBy,
});

export const fetchApprovalRequests = async (): Promise<ApprovalRequest[]> => {
  const response = await apiClient.get<ApprovalRequest[]>('/governance/approvals');
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data ?? [];
};

export const fetchGovernanceSettings = async (): Promise<GovernanceSettings> => {
  const response = await apiClient.get<GovernanceSettings>('/governance/settings');
  if (response.error) {
    throw new Error(response.error);
  }
  return normalizeGovernanceSettings(response.data);
};

export const fetchAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const response = await apiClient.get<AuditLogEntry[]>('/governance/audit');
  if (response.error) {
    throw new Error(response.error);
  }
  return (response.data ?? []).map((entry) => normalizeAuditLogEntry(entry as Partial<AuditLogEntry> & Record<string, unknown>));
};

export const fetchResourceAuditLogs = async (
  resourceType: string,
  resourceId: string,
): Promise<AuditLogEntry[]> => {
  if (!resourceType.trim() || !resourceId.trim()) return [];
  const params = new URLSearchParams({ resourceType, resourceId });
  const response = await apiClient.get<AuditLogEntry[]>(`/audit?${params.toString()}`);
  if (response.error || !response.data) return [];
  return response.data.map((entry) => normalizeAuditLogEntry(entry as Partial<AuditLogEntry> & Record<string, unknown>));
};

export const fetchGovernanceExceptions = async (): Promise<GovernanceTemporaryException[]> => {
  const response = await apiClient.get<GovernanceTemporaryException[]>('/governance/exceptions');
  if (response.error) {
    throw new Error(response.error);
  }
  return (response.data ?? []).map((item) => normalizeGovernanceTemporaryException(item));
};

export const updateGovernanceSettings = async (
  settings: GovernanceSettings
): Promise<GovernanceSettings> => {
  const response = await apiClient.put<GovernanceSettings>('/governance/settings', settings);
  if (response.error) {
    throw new Error(response.error);
  }
  return normalizeGovernanceSettings(response.data ?? settings);
};

export const createGovernanceException = async (
  payload: GovernanceTemporaryExceptionInput,
): Promise<GovernanceTemporaryException> => {
  const response = await apiClient.post<GovernanceTemporaryException>('/governance/exceptions', payload);
  if (response.error) {
    throw new Error(response.error);
  }
  return normalizeGovernanceTemporaryException(response.data);
};

export const revokeGovernanceException = async (
  exceptionId: string,
): Promise<GovernanceTemporaryException> => {
  const response = await apiClient.delete<GovernanceTemporaryException>(`/governance/exceptions/${exceptionId}`);
  if (response.error) {
    throw new Error(response.error);
  }
  return normalizeGovernanceTemporaryException(response.data);
};

export const buildGovernancePolicyDocument = (
  settings: GovernanceSettings,
  exportedAt: string = new Date().toISOString(),
): GovernancePolicyDocument => ({
  kind: 'releasea.governance.policy',
  apiVersion: 'v1',
  exportedAt,
  spec: settings,
});

export const reviewApproval = async (
  approvalId: string,
  status: ApprovalStatus,
  comment?: string
): Promise<boolean> => {
  const response = await apiClient.post(`/governance/approvals/${approvalId}/review`, {
    status,
    comment,
  });
  return !response.error;
};
