export type IdpProtocol = 'saml' | 'oidc';
export type IdpStatus = 'active' | 'inactive' | 'error';
export type IdpRole = 'admin' | 'developer' | 'viewer';

export interface IdpConnection {
  id: string;
  name: string;
  protocol: IdpProtocol;
  status: IdpStatus;
  entityId?: string;
  ssoUrl?: string;
  issuer?: string;
  clientId?: string;
  createdAt: string;
  lastSyncAt?: string;
  usersCount: number;
  groupsCount: number;
}

export interface SamlConfig {
  enabled: boolean;
  entityId: string;
  ssoUrl: string;
  sloUrl: string;
  certificate: string;
  signatureAlgorithm: 'sha1' | 'sha256' | 'sha512';
  digestAlgorithm: 'sha1' | 'sha256' | 'sha512';
  nameIdFormat: 'emailAddress' | 'persistent' | 'transient' | 'unspecified';
  assertionEncrypted: boolean;
  wantAuthnRequestsSigned: boolean;
  allowUnsolicitedResponse: boolean;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups: string;
  };
}

export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  responseType: 'code' | 'id_token' | 'code id_token';
  tokenEndpointAuth: 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';
  userinfoEndpoint: string;
  jwksUri: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups: string;
  };
}

export interface ProvisioningConfig {
  autoProvision: boolean;
  autoDeprovision: boolean;
  syncInterval: number; // minutes
  defaultRole: IdpRole;
  createTeamsFromGroups: boolean;
}

export interface SessionConfig {
  maxAge: number; // seconds
  idleTimeout: number; // seconds
  singleLogout: boolean;
  forceReauth: boolean;
}

export interface SecurityConfig {
  requireMfa: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  ipRestrictions: string[];
}

export interface IdentityProviderConfig {
  saml: SamlConfig;
  oidc: OidcConfig;
  provisioning: ProvisioningConfig;
  session: SessionConfig;
  security: SecurityConfig;
}

export interface GroupMapping {
  id: string;
  externalGroup: string;
  internalTeamId?: string;
  internalTeamName: string;
  role: IdpRole;
  syncEnabled: boolean;
  lastSyncAt?: string;
  memberCount: number;
}

export interface IdpSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  provider: IdpProtocol;
  providerName: string;
  createdAt: string;
  expiresAt: string;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
  active: boolean;
}

export type IdpAuditAction =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'group_sync'
  | 'user_provision'
  | 'user_deprovision'
  | 'config_update';

export interface IdpAuditLog {
  id: string;
  timestamp: string;
  action: IdpAuditAction;
  userId?: string;
  userName?: string;
  provider?: IdpProtocol;
  ipAddress?: string;
  details: string;
}
