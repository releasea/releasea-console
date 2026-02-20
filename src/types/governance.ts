export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalType = 'deploy' | 'rule-publish';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  resourceId: string;
  resourceName: string;
  environment?: string;
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };
  requestedAt: string;
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  reviewComment?: string;
  metadata?: {
    version?: string;
    branch?: string;
    commit?: string;
    gateways?: string[];
    hosts?: string[];
  };
}

export interface GovernanceSettings {
  deployApproval: {
    enabled: boolean;
    environments: string[]; // Which environments require approval
    minApprovers: number;
  };
  rulePublishApproval: {
    enabled: boolean;
    externalOnly: boolean; // Only require approval for external publish
    minApprovers: number;
  };
  auditRetentionDays: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: 'service' | 'rule' | 'deploy' | 'team' | 'settings' | 'user' | 'approval';
  resourceId: string;
  resourceName: string;
  performedBy: {
    id: string;
    name: string;
    email: string;
  };
  performedAt: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}
