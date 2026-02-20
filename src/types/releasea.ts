export type ServiceType = 'static-site' | 'microservice' | 'worker';
export type ServiceStatus =
  | 'running'
  | 'stopped'
  | 'pending'
  | 'creating'
  | 'created'
  | 'deleting'
  | 'error'
  | 'idle';
export type RuntimeStatus = 'healthy' | 'degraded' | 'crashloop' | 'pending' | 'error' | 'unknown';
export type DeployStatus =
  | 'requested'
  | 'scheduled'
  | 'preparing'
  | 'deploying'
  | 'validating'
  | 'progressing'
  | 'promoting'
  | 'completed'
  | 'rollback'
  | 'failed'
  | 'retrying';
export type LegacyDeployStatus = 'success' | 'in-progress' | 'queued';
export type DeployStatusValue = DeployStatus | LegacyDeployStatus;
// Core environments. Dynamic environments (qa, uat, sandbox, etc.) are also
// supported and always map to one of the three fixed namespaces via resolveNamespace.
export type Environment = 'dev' | 'staging' | 'prod' | (string & {});
export type WorkerStatus = 'online' | 'offline' | 'busy' | 'pending';
export type DeployStrategyType = 'rolling' | 'canary' | 'blue-green';
export type ServiceSourceType = 'git' | 'registry';
export type SecretProviderType = 'vault' | 'aws' | 'gcp';
export type TemplateKind = 'service' | 'scheduled-job';
export type TemplateRepoMode = 'template' | 'existing';

export interface TemplateSource {
  provider?: string;
  owner: string;
  repo: string;
  path?: string;
}

export interface TemplateDefaults {
  serviceName?: string;
  sourceType?: 'git' | 'docker';
  repoUrl?: string;
  branch?: string;
  rootDir?: string;
  dockerImage?: string;
  dockerContext?: string;
  dockerfilePath?: string;
  port?: string;
  healthCheckPath?: string;
  framework?: string;
  buildCommand?: string;
  installCommand?: string;
  outputDir?: string;
  cacheTtl?: string;
  dockerCommand?: string;
  preDeployCommand?: string;
  scheduleCron?: string;
  scheduleTimezone?: string;
  scheduleCommand?: string;
  scheduleRetries?: string;
  scheduleTimeout?: string;
}

export interface ServiceTemplate {
  id: string;
  type: 'microservice' | 'static-site';
  label: string;
  description: string;
  icon?: string;
  category: string;
  owner: string;
  bestFor: string;
  defaults: string;
  setupTime: string;
  tier: string;
  highlights: string[];
  templateKind?: TemplateKind;
  templateDefaults?: TemplateDefaults;
  templatePath?: string;
  templateSource?: TemplateSource;
  repoMode?: TemplateRepoMode;
  allowTemplateToggle?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeployStrategyConfig {
  type: DeployStrategyType;
  canaryPercent?: number;
  blueGreenPrimary?: 'blue' | 'green';
}

export interface EnvironmentConfig {
  id: Environment;
  name: string;
  description?: string;
  namespace?: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  members: TeamMember[];
  createdAt: string;
}

export type TeamRole = 'admin' | 'developer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatar?: string;
  idpProvider?: 'keycloak' | 'adfs' | 'azure-ad' | 'okta';
}

export interface AuthUser extends TeamMember {
  teamId: string;
  teamName: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  teamId: string;
  owner?: string;
  repositoryUrl?: string;
  runbookUrl?: string;
  alertChannel?: string;
  costCenter?: string;
  defaultEnvironment?: Environment;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  serviceTier?: 'standard' | 'business-critical' | 'mission-critical';
  scmCredentialId?: string;
  registryCredentialId?: string;
  createdAt: string;
  updatedAt: string;
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  status: ServiceStatus;
  isActive?: boolean;
  autoDeploy?: boolean;
  pauseOnIdle?: boolean;
  pauseIdleTimeoutSeconds?: number;
  projectId: string;
  url?: string;
  port?: number;
  healthCheckPath?: string;
  replicas: number;
  minReplicas?: number;
  maxReplicas?: number;
  cpu: number;
  memory: number;
  createdAt: string;
  lastDeployAt?: string;
  environment: Record<string, string>;
  deploymentStrategy?: DeployStrategyConfig;
  ruleIds: string[]; // References to Rule.id
  sourceType?: ServiceSourceType;
  repoUrl?: string;
  branch?: string;
  rootDir?: string;
  dockerImage?: string;
  dockerContext?: string;
  dockerfilePath?: string;
  dockerCommand?: string;
  preDeployCommand?: string;
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDir?: string;
  cacheTtl?: string | number;
  scmCredentialId?: string;
  registryCredentialId?: string;
  deployTemplateId?: string;
  secretProviderId?: string;
  runtime?: Record<string, ServiceRuntimeState>;
  repoManaged?: boolean;
  scheduleCron?: string;
  scheduleTimezone?: string;
  scheduleCommand?: string;
  scheduleRetries?: string | number;
  scheduleTimeout?: string | number;
  profileId?: string;
}

export interface ServiceRuntimeState {
  status: RuntimeStatus;
  reason?: string;
  updatedAt?: string;
}

// Istio-native rule definitions
export type RuleProtocol = 'http' | 'https' | 'grpc' | 'tcp';

export interface Rule {
  id: string;
  name: string;
  serviceId: string;
  environment: Environment;
  hosts: string[];
  gateways: string[]; // internal gateway names + external gateway names
  paths: string[];
  methods: string[];
  protocol: RuleProtocol;
  port: number;
}

export type RuleStatus =
  | 'draft'
  | 'published'
  | 'queued'
  | 'in-progress'
  | 'publishing'
  | 'unpublishing';

export interface RulePolicyConfig {
  action: 'allow' | 'deny';
  timeoutMs: number;
  retries: number;
  ipPolicy: 'open' | 'allowlist' | 'blocklist';
  ipList?: string[];
  requiredHeaders?: string[];
}

export interface ManagedRule extends Rule {
  status: RuleStatus;
  createdAt: string;
  updatedAt: string;
  lastPublishedAt?: string;
  policy: RulePolicyConfig;
}

export interface Deploy {
  id: string;
  serviceId: string;
  status: DeployStatusValue;
  environment?: string;
  commit?: string;
  branch?: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  logs: string[];
  strategyStatus?: DeployStrategyStatus;
}

export interface DeployStrategyStatus {
  type?: DeployStrategyType | string;
  phase?: string;
  summary?: string;
  details?: Record<string, string | number | boolean>;
  updatedAt?: string;
}

export interface RuleDeploy {
  id: string;
  ruleId: string;
  serviceId: string;
  status: DeployStatusValue;
  environment?: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  logs: string[];
}

export interface ServiceStatusSnapshot {
  service: Service;
  deploys: Deploy[];
  rules: ManagedRule[];
  ruleDeploys: RuleDeploy[];
  emittedAt: string;
}

export interface ServicesStatusSnapshot {
  services: Service[];
  deploys: Deploy[];
  emittedAt: string;
}

export interface Worker {
  id: string;
  primaryId?: string;
  agentIds?: string[];
  credentialIds?: string[];
  name: string;
  status: WorkerStatus;
  environment: Environment;
  tags: string[];
  cluster: string;
  namespacePrefix: string;
  namespace: string;
  version: string;
  lastHeartbeat: string;
  currentTask?: string;
  tasksCompleted: number;
  registeredAt: string;
  desiredAgents: number;
  onlineAgents: number;
  credentialId: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  serviceId: string;
  metadata?: Record<string, unknown>;
}

export interface MetricsDiagnostics {
  prometheusUrl?: string;
  namespace?: string;
  serviceName?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  cpuQuerySuccess?: boolean;
  memQuerySuccess?: boolean;
  latencyQuerySuccess?: boolean;
  reqQuerySuccess?: boolean;
  error?: string;
}

export interface StatusCodeSeries {
  '2xx': number[];
  '4xx': number[];
  '5xx': number[];
}

export interface Metrics {
  serviceId: string;
  environment?: string;
  namespace?: string;
  cpu: number[];
  memory: number[];
  latencyP95: number[];
  requests: number[];
  timestamps: string[];
  statusCodes?: StatusCodeSeries;
  diagnostics?: MetricsDiagnostics;
}

export interface ServicePodList {
  pods: string[];
  namespace: string;
  serviceName: string;
  error?: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  flag: string;
  available: boolean;
}

export interface WorkerRegistration {
  id: string;
  name: string;
  environment: Environment;
  tags: string[];
  cluster: string;
  namespacePrefix: string;
  namespace: string;
  createdAt: string;
  token: string;
  status: 'unused' | 'active' | 'inactive' | 'revoked';
  notes?: string;
}

export type CredentialScope = 'platform' | 'project' | 'service';

export interface ScmCredential {
  id: string;
  name: string;
  provider: string;
  authType: string;
  scope: CredentialScope;
  projectId?: string;
  serviceId?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface RegistryCredential {
  id: string;
  name: string;
  provider?: string;
  registryUrl?: string;
  username?: string;
  scope: CredentialScope;
  projectId?: string;
  serviceId?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface TemplateRepoResponse {
  id: number;
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
  };
}

export type ExternalEndpointProtocol = 'https' | 'grpc' | 'tcp';

export interface ExternalEndpoint {
  id: string;
  name: string;
  hostname: string;
  port: number;
  protocol: ExternalEndpointProtocol;
  certificateName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedProvider {
  id: string;
  name: string;
  email: string | null;
  connected: boolean;
}

export interface UserSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: TeamMember['role'];
  teamId: string;
  teamName: string;
  avatar?: string;
  identityProvider?: 'saml' | 'oidc' | 'keycloak' | 'azure-ad' | 'okta' | 'google' | 'microsoft';
  twoFactorEnabled: boolean;
  connectedProviders: ConnectedProvider[];
  sessions: UserSession[];
}

export interface PlatformIntegration {
  name: string;
  status: 'connected' | 'disconnected';
  icon: string;
  description: string;
}

export interface PlatformSettings {
  organization: {
    name: string;
    slug: string;
    apiUrl: string;
  };
  database: {
    mongoUri: string;
    rabbitUrl: string;
  };
  identity: {
    saml: {
      enabled: boolean;
      entityId: string;
      ssoUrl: string;
      certificate: string;
    };
    keycloak: {
      enabled: boolean;
      url: string;
      realm: string;
      clientId: string;
      clientSecret: string;
    };
  };
  notifications: {
    deploySuccess: boolean;
    deployFailed: boolean;
    serviceDown: boolean;
    workerOffline: boolean;
    highCpu: boolean;
  };
  security: {
    require2fa: boolean;
    ipAllowlist: boolean;
    auditLogs: boolean;
  };
  integrations: PlatformIntegration[];
  secrets?: SecretsSettings;
}

export interface SecretsSettings {
  defaultProviderId: string;
  providers: SecretProvider[];
}

export interface SecretProvider {
  id: string;
  name: string;
  type: SecretProviderType;
  status: 'connected' | 'disconnected';
  config: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
}
