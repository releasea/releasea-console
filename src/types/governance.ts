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
  deployPolicy: {
    enabled: boolean;
    dryRun: boolean;
    rules: Array<{
      environment: string;
      allowAutoDeploy: boolean;
      requireExplicitVersion: boolean;
      blockExternalExposure: boolean;
      allowedProfileIds: string[];
      allowedScmProviders: string[];
      allowedRegistryProviders: string[];
      allowedSecretProviders: string[];
      allowedSourceTypes: string[];
      allowedRegistries: string[];
      allowedStrategies: string[];
      maxReplicas: number;
    }>;
  };
  rulePublishApproval: {
    enabled: boolean;
    externalOnly: boolean; // Only require approval for external publish
    minApprovers: number;
  };
  auditRetentionDays: number;
}

export interface GovernancePolicyDocument {
  kind: 'releasea.governance.policy';
  apiVersion: 'v1';
  exportedAt: string;
  spec: GovernanceSettings;
}

export interface GovernanceTemporaryException {
  id: string;
  policy: 'deploy-policy' | (string & {});
  serviceId: string;
  serviceName: string;
  environment: string;
  codes: string[];
  reason: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked' | (string & {});
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  };
  revokedAt?: string;
  revokedBy?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface GovernanceTemporaryExceptionInput {
  policy: 'deploy-policy';
  serviceId: string;
  environment: string;
  codes: string[];
  reason: string;
  expiresAt: string;
}

export interface DeployPolicyExceptionApplied {
  id: string;
  policy: string;
  environment: string;
  codes: string[];
  reason: string;
  expiresAt: string;
  createdAt?: string;
  status?: string;
}

export interface DeployPolicyViolation {
  code: string;
  environment: string;
  message: string;
  rule?: Record<string, unknown>;
}

export interface DeployPolicyPreflight {
  environment: string;
  trigger: string;
  sourceType: string;
  registryHost?: string;
  strategyType: string;
  replicas: number;
  explicitVersion: boolean;
  dryRun?: boolean;
  target: {
    profileId?: string;
    scmProvider?: string;
    registryProvider?: string;
    secretProvider?: string;
  };
  exceptionsApplied?: DeployPolicyExceptionApplied[];
  violations: DeployPolicyViolation[];
}

export interface RulePublishPolicyPreflight {
  environment: string;
  internal: boolean;
  external: boolean;
  dryRun?: boolean;
  violations: DeployPolicyViolation[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
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
