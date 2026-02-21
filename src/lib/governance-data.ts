import type {
  ApprovalRequest,
  ApprovalStatus,
  AuditLogEntry,
  GovernanceSettings,
} from '@/types/governance';
import { apiClient } from '@/lib/api-client';

const EMPTY_GOVERNANCE_SETTINGS: GovernanceSettings = {
  deployApproval: {
    enabled: false,
    environments: [],
    minApprovers: 1,
  },
  rulePublishApproval: {
    enabled: false,
    externalOnly: false,
    minApprovers: 1,
  },
  auditRetentionDays: 30,
};

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
  return response.data ?? EMPTY_GOVERNANCE_SETTINGS;
};

export const fetchAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const response = await apiClient.get<AuditLogEntry[]>('/governance/audit');
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data ?? [];
};

export const updateGovernanceSettings = async (
  settings: GovernanceSettings
): Promise<GovernanceSettings> => {
  const response = await apiClient.put<GovernanceSettings>('/governance/settings', settings);
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data ?? settings;
};

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
