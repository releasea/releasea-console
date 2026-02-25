import { apiClient } from '@/lib/api-client';
import { clientLogger } from '@/platform/logging/client-logger';
import type {
  IdentityProviderConfig,
  GroupMapping,
  IdpSession,
  IdpAuditLog,
} from '@/types/identity-provider';

const EMPTY_IDP_CONFIG: IdentityProviderConfig = {
  saml: {
    enabled: false,
    entityId: '',
    ssoUrl: '',
    sloUrl: '',
    certificate: '',
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    nameIdFormat: 'emailAddress',
    assertionEncrypted: false,
    wantAuthnRequestsSigned: true,
    allowUnsolicitedResponse: false,
    attributeMapping: {
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      groups: 'groups',
    },
  },
  oidc: {
    enabled: false,
    issuer: '',
    clientId: '',
    clientSecret: '',
    scopes: [],
    responseType: 'code',
    tokenEndpointAuth: 'client_secret_post',
    userinfoEndpoint: '',
    jwksUri: '',
    attributeMapping: {
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      groups: 'groups',
    },
  },
  provisioning: {
    autoProvision: false,
    autoDeprovision: false,
    syncInterval: 60,
    defaultRole: 'developer',
    createTeamsFromGroups: false,
  },
  session: {
    maxAge: 86400,
    idleTimeout: 3600,
    singleLogout: false,
    forceReauth: false,
  },
  security: {
    requireMfa: false,
    allowedDomains: [],
    blockedDomains: [],
    ipRestrictions: [],
  },
};

const EMPTY_GROUP_MAPPINGS: GroupMapping[] = [];
const EMPTY_IDP_SESSIONS: IdpSession[] = [];
const EMPTY_IDP_AUDIT_LOGS: IdpAuditLog[] = [];

type ApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

const resolveResponse = async <T>(
  request: Promise<ApiResult<T>>,
  fallback: T,
  label: string
): Promise<T> => {
  const { data, error } = await request;
  if (error || data == null) {
    clientLogger.warn(`api.${label}`, 'Request failed', { error });
    return fallback;
  }
  return data;
};

const resolveAction = async (
  request: Promise<ApiResult<unknown>>,
  label: string
): Promise<boolean> => {
  const { error } = await request;
  if (error) {
    clientLogger.warn(`api.${label}`, 'Action failed', { error });
    return false;
  }
  return true;
};

// IdP Configuration
export const fetchIdpConfig = async (): Promise<IdentityProviderConfig> => {
  return resolveResponse(
    apiClient.get<IdentityProviderConfig>('/identity/config'),
    EMPTY_IDP_CONFIG,
    'fetchIdpConfig'
  );
};

export const updateIdpConfig = async (
  config: IdentityProviderConfig
): Promise<IdentityProviderConfig> => {
  return resolveResponse(
    apiClient.put<IdentityProviderConfig>('/identity/config', config),
    config,
    'updateIdpConfig'
  );
};

// Group Mappings
export const fetchGroupMappings = async (): Promise<GroupMapping[]> => {
  return resolveResponse(
    apiClient.get<GroupMapping[]>('/identity/mappings'),
    EMPTY_GROUP_MAPPINGS,
    'fetchGroupMappings'
  );
};

export const createGroupMapping = async (mapping: Partial<GroupMapping>): Promise<GroupMapping> => {
  const fallback: GroupMapping = {
    id: `mapping-${Date.now()}`,
    externalGroup: mapping.externalGroup ?? '',
    internalTeamId: mapping.internalTeamId,
    internalTeamName: mapping.internalTeamName ?? '',
    role: mapping.role ?? 'developer',
    syncEnabled: mapping.syncEnabled ?? true,
    memberCount: 0,
  };
  return resolveResponse(
    apiClient.post<GroupMapping>('/identity/mappings', mapping),
    fallback,
    'createGroupMapping'
  );
};

export const deleteGroupMapping = async (mappingId: string): Promise<boolean> => {
  return resolveAction(apiClient.delete(`/identity/mappings/${mappingId}`), 'deleteGroupMapping');
};

export const syncGroupMappings = async (): Promise<boolean> => {
  return resolveAction(apiClient.post('/identity/mappings/sync', {}), 'syncGroupMappings');
};

// Sessions
export const fetchIdpSessions = async (): Promise<IdpSession[]> => {
  return resolveResponse(
    apiClient.get<IdpSession[]>('/identity/sessions'),
    EMPTY_IDP_SESSIONS,
    'fetchIdpSessions'
  );
};

export const revokeIdpSession = async (sessionId: string): Promise<boolean> => {
  return resolveAction(apiClient.delete(`/identity/sessions/${sessionId}`), 'revokeIdpSession');
};

// Audit Logs
export const fetchIdpAuditLogs = async (): Promise<IdpAuditLog[]> => {
  return resolveResponse(
    apiClient.get<IdpAuditLog[]>('/identity/audit'),
    EMPTY_IDP_AUDIT_LOGS,
    'fetchIdpAuditLogs'
  );
};

// Test connection
export const testIdpConnection = async (protocol: 'saml' | 'oidc'): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    `/identity/test/${protocol}`,
    {}
  );
  if (response.error || !response.data) {
    return { success: false, message: response.error ?? 'Connection test failed' };
  }
  return response.data;
};
