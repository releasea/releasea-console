import { AppConfig, getApiUrl } from '@/lib/config';
import { apiClient } from '@/lib/api-client';
import { clientLogger } from '@/platform/logging/client-logger';
import {
  authExchangeSSORequestSchema,
  authSessionRequestSchema,
  authSessionResponseSchema,
  authSignUpRequestSchema,
  createDeployRequestSchema,
  promoteCanaryRequestSchema,
  promoteCanaryResponseSchema,
} from '@/platform/http/contracts/contracts';
import type {
  AuthUser,
  DiscoveredWorkload,
  Deploy,
  Environment,
  ExternalEndpoint,
  EnvironmentConfig,
  LogEntry,
  Metrics,
  ProviderCatalog,
  ProviderHealthCatalog,
  ProviderStatusCatalog,
  PlatformSettings,
  Project,
  ControlPlaneMetrics,
  RegistryCredential,
  ManagedRule,
  RuleDeploy,
  ScmCredential,
  Service,
  ServiceGitOpsDriftStatus,
  ServiceGitOpsLayoutPreset,
  ServiceGitOpsRepositoryPolicyCheck,
  ServiceGitOpsPullRequest,
  ServiceGitOpsTimelineEvent,
  ServiceDesiredStateExport,
  ServiceDesiredStateValidation,
  ServicePodList,
  ServiceTemplate,
  Team,
  TemplateRepoResponse,
  UserProfile,
  Worker,
  WorkerBootstrapProfile,
  WorkerPool,
  WorkerRegistration,
} from '@/types/releasea';
import type {
  AuditLogEntry,
  DeployPolicyPreflight,
  DeployPolicyViolation,
  RulePublishPolicyPreflight,
} from '@/types/governance';
import { extractDeployPolicyViolations } from '@/lib/deploy-policy';
import { getEnvironmentConfigs, saveEnvironmentConfigs } from '@/lib/environments';

const EMPTY_PLATFORM_SETTINGS: PlatformSettings = {
  organization: { name: '', slug: '', apiUrl: '' },
  database: { mongoUri: '', rabbitUrl: '' },
  identity: {
    saml: { enabled: false, entityId: '', ssoUrl: '', certificate: '' },
    keycloak: { enabled: false, url: '', realm: '', clientId: '', clientSecret: '' },
  },
  notifications: {
    deploySuccess: false,
    deployFailed: false,
    serviceDown: false,
    workerOffline: false,
    highCpu: false,
  },
  security: { require2fa: false, ipAllowlist: false, auditLogs: false },
  integrations: [],
  secrets: {
    defaultProviderId: '',
    providers: [],
  },
};

const EMPTY_PROFILE: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'developer',
  teamId: '',
  teamName: '',
  twoFactorEnabled: false,
  connectedProviders: [],
  sessions: [],
};

const EMPTY_TEAMS: Team[] = [];
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_WORKERS: Worker[] = [];
const EMPTY_WORKER_POOLS: WorkerPool[] = [];
const EMPTY_WORKER_REGISTRATIONS: WorkerRegistration[] = [];
const EMPTY_DISCOVERED_WORKLOADS: DiscoveredWorkload[] = [];
const EMPTY_WORKER_BOOTSTRAP_PROFILE: WorkerBootstrapProfile = {
  id: 'worker-bootstrap-profile',
  mode: 'same-cluster',
  version: '1',
  platformNamespace: 'releasea-system',
  apiBaseUrl: 'http://releasea-api.releasea-system.svc.cluster.local:8070/api/v1',
  rabbitmqUrl: 'amqp://releasea:releasea@releasea-rabbitmq.releasea-system.svc.cluster.local:5672/',
  internalDomain: 'releasea.internal',
  externalDomain: 'releasea.external',
  internalGateway: 'istio-system/releasea-internal-gateway',
  externalGateway: 'istio-system/releasea-external-gateway',
  namespacePrefix: 'releasea-apps',
  minioEndpoint: 'releasea-minio.releasea-system.svc.cluster.local:9000',
  minioBucket: 'releasea-static',
  minioSecure: false,
  staticNginxService: 'releasea-static-nginx',
  staticNginxNamespace: 'releasea-system',
  source: {
    configMap: 'releasea-worker-bootstrap',
    secret: 'releasea-worker-bootstrap',
  },
};
const EMPTY_PROVIDER_CATALOG: ProviderCatalog = {
  version: '1',
  scm: {
    kind: 'scm',
    label: 'SCM',
    description: 'Source control providers used for repository access and template operations.',
    defaultProvider: 'github',
    providers: [
      {
        id: 'github',
        label: 'GitHub',
        description: 'Built-in GitHub support used by templates, commit lookup and repository cloning.',
        authModes: ['token', 'ssh'],
        capabilities: ['repo-clone', 'template-repos', 'commit-history', 'pull-requests'],
        scopeSupport: ['platform', 'project', 'service'],
      },
      {
        id: 'gitlab',
        label: 'GitLab',
        description: 'Credential option for repository cloning in worker build flows.',
        authModes: ['token', 'ssh'],
        capabilities: ['repo-clone'],
        scopeSupport: ['platform', 'project', 'service'],
      },
      {
        id: 'bitbucket',
        label: 'Bitbucket',
        description: 'Credential option for repository cloning in worker build flows.',
        authModes: ['token', 'ssh'],
        capabilities: ['repo-clone'],
        scopeSupport: ['platform', 'project', 'service'],
      },
    ],
  },
  registry: {
    kind: 'registry',
    label: 'Registry',
    description: 'Container registries available to build and deploy pipelines.',
    defaultProvider: 'docker',
    providers: [
      {
        id: 'docker',
        label: 'Docker Registry',
        description: 'Generic OCI registry using username and password authentication.',
        authModes: ['basic'],
        capabilities: ['image-push', 'image-pull'],
        scopeSupport: ['platform', 'project', 'service'],
      },
      {
        id: 'ghcr',
        label: 'GitHub Container Registry',
        description: 'OCI registry hosted by GitHub with standard basic credentials.',
        authModes: ['basic'],
        capabilities: ['image-push', 'image-pull'],
        scopeSupport: ['platform', 'project', 'service'],
      },
      {
        id: 'ecr',
        label: 'AWS ECR',
        description: 'AWS Elastic Container Registry using generated username and password credentials.',
        authModes: ['basic'],
        capabilities: ['image-push', 'image-pull'],
        scopeSupport: ['platform', 'project', 'service'],
      },
      {
        id: 'gcr',
        label: 'Google Container Registry',
        description: 'Google-hosted registry using standard username and password credentials.',
        authModes: ['basic'],
        capabilities: ['image-push', 'image-pull'],
        scopeSupport: ['platform', 'project', 'service'],
      },
      {
        id: 'acr',
        label: 'Azure Container Registry',
        description: 'Azure-hosted registry using standard username and password credentials.',
        authModes: ['basic'],
        capabilities: ['image-push', 'image-pull'],
        scopeSupport: ['platform', 'project', 'service'],
      },
    ],
  },
  secrets: {
    kind: 'secrets',
    label: 'Secrets',
    description: 'Secrets managers available for resolving secret references during deploys.',
    defaultProvider: 'vault',
    providers: [
      {
        id: 'vault',
        label: 'Vault',
        description: 'HashiCorp Vault backed secret resolution.',
        capabilities: ['secret-read', 'secret-reference'],
        configFields: ['address', 'token'],
      },
      {
        id: 'aws',
        label: 'AWS Secrets Manager',
        description: 'AWS-hosted secret resolution using access key credentials.',
        capabilities: ['secret-read', 'secret-reference'],
        configFields: ['accessKeyId', 'secretAccessKey', 'region'],
      },
      {
        id: 'gcp',
        label: 'GCP Secret Manager',
        description: 'Google Cloud secret resolution using service account credentials.',
        capabilities: ['secret-read', 'secret-reference'],
        configFields: ['projectId', 'serviceAccountJson'],
      },
    ],
  },
  identity: {
    kind: 'identity',
    label: 'Identity',
    description: 'Identity protocols supported by Releasea. Providers such as Keycloak, Okta, Azure AD, Google and Microsoft typically connect through OIDC.',
    providers: [
      {
        id: 'saml',
        label: 'SAML',
        description: 'SAML 2.0 single sign-on with group mapping and audit events.',
        capabilities: ['single-sign-on', 'group-mapping', 'session-revocation'],
        implementation: 'saml',
      },
      {
        id: 'oidc',
        label: 'OIDC',
        description: 'Generic OpenID Connect support for providers such as Keycloak, Okta, Azure AD and Google.',
        capabilities: ['single-sign-on', 'group-mapping', 'session-revocation'],
        implementation: 'oidc',
      },
    ],
  },
  notifications: {
    kind: 'notifications',
    label: 'Notifications',
    description: 'Built-in platform event notifications currently configurable in platform settings.',
    defaultProvider: 'platform-events',
    providers: [
      {
        id: 'platform-events',
        label: 'Platform Events',
        description: 'Built-in notification toggles for deploy, service, worker and approval events.',
        capabilities: ['deploy-success', 'deploy-failed', 'service-down', 'worker-offline', 'approval-required', 'approval-completed'],
      },
    ],
  },
};
const EMPTY_PROVIDER_STATUS: ProviderStatusCatalog = {
  version: '1',
  scm: { kind: 'scm', providers: [] },
  registry: { kind: 'registry', providers: [] },
  secrets: { kind: 'secrets', providers: [] },
  identity: { kind: 'identity', providers: [] },
  notifications: { kind: 'notifications', providers: [] },
};
const EMPTY_PROVIDER_HEALTH: ProviderHealthCatalog = {
  version: '1',
  scm: { kind: 'scm', healthy: 0, unhealthy: 0, checks: [] },
  registry: { kind: 'registry', healthy: 0, unhealthy: 0, checks: [] },
  secrets: { kind: 'secrets', healthy: 0, unhealthy: 0, checks: [] },
  identity: { kind: 'identity', healthy: 0, unhealthy: 0, checks: [] },
  notifications: { kind: 'notifications', healthy: 0, unhealthy: 0, checks: [] },
};
const EMPTY_DEPLOYS: Deploy[] = [];
const EMPTY_LOGS: LogEntry[] = [];
const EMPTY_RULES: ManagedRule[] = [];

type ApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

const resolveResponse = async <T>(request: Promise<ApiResult<T>>, fallback: T, label: string): Promise<T> => {
  const { data, error } = await request;
  if (error || data == null) {
    clientLogger.warn(`api.${label}`, 'Request failed', { error });
    return fallback;
  }
  return data;
};

const resolveAction = async (request: Promise<ApiResult<unknown>>, label: string): Promise<boolean> => {
  const { error } = await request;
  if (error) {
    clientLogger.warn(`api.${label}`, 'Action failed', { error });
    return false;
  }
  return true;
};

type ResourceOptions<T> = {
  fallback: T;
  endpoint: string;
  label: string;
};

type ActionOptions<T> = ResourceOptions<T> & { payload: unknown };

const fetchResource = async <T>({ fallback, endpoint, label }: ResourceOptions<T>): Promise<T> =>
  resolveResponse(apiClient.get<T>(endpoint, { timeout: AppConfig.listRequestTimeout }), fallback, label);

const postResource = async <T>({ fallback, endpoint, payload, label }: ActionOptions<T>): Promise<T> =>
  resolveResponse(apiClient.post<T>(endpoint, payload), fallback, label);

const putResource = async <T>({ fallback, endpoint, payload, label }: ActionOptions<T>): Promise<T> =>
  resolveResponse(apiClient.put<T>(endpoint, payload), fallback, label);

const deleteResource = async (endpoint: string, label: string): Promise<boolean> =>
  resolveAction(apiClient.delete(endpoint), label);

export const performAction = async (options: {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'DELETE';
  payload?: unknown;
  label: string;
}): Promise<boolean> => {
  const { endpoint, method = 'POST', payload, label } = options;
  const isCreateDeploy = /^\/services\/[^/]+\/deploys$/i.test(endpoint.trim());
  const createDeployPayloadSchema = isCreateDeploy ? createDeployRequestSchema : undefined;
  if (method === 'PUT') {
    if (createDeployPayloadSchema) {
      return resolveAction(apiClient.put(endpoint, payload, { requestSchema: createDeployPayloadSchema }), label);
    }
    return resolveAction(apiClient.put(endpoint, payload), label);
  }
  if (method === 'DELETE') {
    return resolveAction(apiClient.delete(endpoint), label);
  }
  if (createDeployPayloadSchema) {
    return resolveAction(
      apiClient.post(endpoint, payload ?? {}, {
        requestSchema: createDeployPayloadSchema,
      }),
      label,
    );
  }
  return resolveAction(
    apiClient.post(endpoint, payload ?? {}),
    label,
  );
};

export const fetchTeams = async (): Promise<Team[]> =>
  fetchResource({ fallback: EMPTY_TEAMS, endpoint: '/teams', label: 'fetchTeams' });

export const fetchProjects = async (): Promise<Project[]> =>
  fetchResource({ fallback: EMPTY_PROJECTS, endpoint: '/projects', label: 'fetchProjects' });

export const fetchServices = async (): Promise<Service[]> =>
  fetchResource({ fallback: EMPTY_SERVICES, endpoint: '/services', label: 'fetchServices' });

export const fetchService = async (serviceId: string): Promise<Service | null> =>
  fetchResource({ fallback: null, endpoint: `/services/${serviceId}`, label: 'fetchService' });

export const fetchWorkers = async (): Promise<Worker[]> =>
  fetchResource({ fallback: EMPTY_WORKERS, endpoint: '/workers?view=summary', label: 'fetchWorkers' });

export const fetchWorkerPools = async (): Promise<WorkerPool[]> =>
  fetchResource({ fallback: EMPTY_WORKER_POOLS, endpoint: '/workers/pools', label: 'fetchWorkerPools' });

export const setWorkerPoolMaintenance = async (
  poolId: string,
  payload: { enabled: boolean; reason?: string },
): Promise<boolean> => {
  const response = await apiClient.post(`/workers/pools/${encodeURIComponent(poolId)}/maintenance`, payload);
  if (response.error) {
    clientLogger.warn('api.setWorkerPoolMaintenance', 'Request failed', { poolId, error: response.error });
    return false;
  }
  return true;
};

export const setWorkerPoolDrain = async (
  poolId: string,
  payload: { enabled: boolean; reason?: string },
): Promise<boolean> => {
  const response = await apiClient.post(`/workers/pools/${encodeURIComponent(poolId)}/drain`, payload);
  if (response.error) {
    clientLogger.warn('api.setWorkerPoolDrain', 'Request failed', { poolId, error: response.error });
    return false;
  }
  return true;
};

export const fetchWorkerRegistrations = async (): Promise<WorkerRegistration[]> =>
  fetchResource({
    fallback: EMPTY_WORKER_REGISTRATIONS,
    endpoint: '/workers/registrations',
    label: 'fetchWorkerRegistrations',
  });

export const fetchDiscoveredWorkloads = async (environment?: string): Promise<DiscoveredWorkload[]> => {
  const query = new URLSearchParams();
  if (environment) {
    query.set('environment', environment);
  }
  const suffix = query.toString();
  return fetchResource({
    fallback: EMPTY_DISCOVERED_WORKLOADS,
    endpoint: suffix ? `/workers/discovered-workloads?${suffix}` : '/workers/discovered-workloads',
    label: 'fetchDiscoveredWorkloads',
  });
};

export const fetchWorkerBootstrapProfile = async (): Promise<WorkerBootstrapProfile> =>
  fetchResource({
    fallback: EMPTY_WORKER_BOOTSTRAP_PROFILE,
    endpoint: '/workers/bootstrap-profile',
    label: 'fetchWorkerBootstrapProfile',
  });

export const fetchProviderCatalog = async (): Promise<ProviderCatalog> =>
  fetchResource({
    fallback: EMPTY_PROVIDER_CATALOG,
    endpoint: '/settings/providers/catalog',
    label: 'fetchProviderCatalog',
  });

export const fetchProviderStatus = async (): Promise<ProviderStatusCatalog> =>
  fetchResource({
    fallback: EMPTY_PROVIDER_STATUS,
    endpoint: '/settings/providers/status',
    label: 'fetchProviderStatus',
  });

export const fetchProviderHealth = async (): Promise<ProviderHealthCatalog> =>
  fetchResource({
    fallback: EMPTY_PROVIDER_HEALTH,
    endpoint: '/settings/providers/health',
    label: 'fetchProviderHealth',
  });

export const fetchScmCredentials = async (): Promise<ScmCredential[]> =>
  fetchResource({ fallback: [], endpoint: '/credentials/scm', label: 'fetchScmCredentials' });

export const fetchRegistryCredentials = async (): Promise<RegistryCredential[]> =>
  fetchResource({ fallback: [], endpoint: '/credentials/registry', label: 'fetchRegistryCredentials' });

export const fetchServiceTemplates = async (): Promise<ServiceTemplate[]> =>
  fetchResource({ fallback: [], endpoint: '/templates', label: 'fetchServiceTemplates' });

export const verifyServiceTemplates = async (
  payload: Partial<ServiceTemplate>[],
): Promise<ServiceTemplate[]> =>
  postResource({
    fallback: payload as ServiceTemplate[],
    endpoint: '/templates/verify',
    payload,
    label: 'verifyServiceTemplates',
  });

export const createServiceTemplate = async (payload: Partial<ServiceTemplate>): Promise<ServiceTemplate | null> => {
  const response = await apiClient.post<ServiceTemplate>('/templates', payload);
  if (response.error || !response.data) {
    clientLogger.warn('api.createServiceTemplate', 'Request failed', { error: response.error });
    return null;
  }
  return response.data;
};

export const updateServiceTemplate = async (
  id: string,
  payload: Partial<ServiceTemplate>,
): Promise<ServiceTemplate | null> => {
  const response = await apiClient.put<ServiceTemplate>(`/templates/${id}`, payload);
  if (response.error || !response.data) {
    clientLogger.warn('api.updateServiceTemplate', 'Request failed', { error: response.error });
    return null;
  }
  return response.data;
};

export const deleteServiceTemplate = async (id: string): Promise<boolean> =>
  deleteResource(`/templates/${id}`, 'deleteServiceTemplate');

export const createScmCredential = async (payload: Partial<ScmCredential> & { token?: string; privateKey?: string }): Promise<ScmCredential> =>
  postResource({
    fallback: payload as ScmCredential,
    endpoint: '/credentials/scm',
    payload,
    label: 'createScmCredential',
  });

export const createRegistryCredential = async (payload: Partial<RegistryCredential> & { password?: string }): Promise<RegistryCredential> =>
  postResource({
    fallback: payload as RegistryCredential,
    endpoint: '/credentials/registry',
    payload,
    label: 'createRegistryCredential',
  });

export const deleteScmCredential = async (id: string): Promise<boolean> =>
  deleteResource(`/credentials/scm/${encodeURIComponent(id)}`, 'deleteScmCredential');

export const deleteRegistryCredential = async (id: string): Promise<boolean> =>
  deleteResource(`/credentials/registry/${encodeURIComponent(id)}`, 'deleteRegistryCredential');

export type TemplateRepoPayload = {
  scmCredentialId?: string;
  projectId?: string;
  templateOwner: string;
  templateRepo: string;
  templatePath?: string;
  owner: string;
  name: string;
  description?: string;
  private?: boolean;
  includeAllBranches?: boolean;
};

export type TemplateRepoAvailabilityPayload = {
  scmCredentialId?: string;
  projectId?: string;
  owner: string;
  name: string;
};

type TemplateRepoAvailabilityResponse = {
  exists: boolean;
  owner: string;
  name: string;
  fullName: string;
};

export const checkGithubTemplateRepoAvailability = async (
  payload: TemplateRepoAvailabilityPayload,
): Promise<{ exists: boolean | null; error: string | null }> => {
  const query = new URLSearchParams();
  query.set('owner', payload.owner);
  query.set('name', payload.name);
  if (payload.projectId) query.set('projectId', payload.projectId);
  if (payload.scmCredentialId) query.set('scmCredentialId', payload.scmCredentialId);

  const response = await apiClient.get<TemplateRepoAvailabilityResponse>(
    `/scm/github/template-repos/availability?${query.toString()}`,
  );
  if (response.error || !response.data) {
    clientLogger.warn('api.checkGithubTemplateRepoAvailability', 'Request failed', { error: response.error });
    return { exists: null, error: response.error || 'Failed to check repository availability' };
  }
  return { exists: Boolean(response.data.exists), error: null };
};

export const createGithubTemplateRepo = async (
  payload: TemplateRepoPayload,
): Promise<{ repo: TemplateRepoResponse | null; error: string | null }> => {
  const response = await apiClient.post<TemplateRepoResponse>('/scm/github/template-repos', payload);
  if (response.error || !response.data) {
    clientLogger.warn('api.createGithubTemplateRepo', 'Request failed', { error: response.error });
    return { repo: null, error: response.error || 'Failed to create repository' };
  }
  return { repo: response.data, error: null };
};

export const fetchDeploys = async (): Promise<Deploy[]> =>
  fetchResource({ fallback: EMPTY_DEPLOYS, endpoint: '/deploys', label: 'fetchDeploys' });

export type ScmCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export const fetchScmCommits = async (
  repoUrl: string,
  branch?: string,
  projectId?: string,
): Promise<ScmCommit[]> => {
  const query = new URLSearchParams();
  query.set('repoUrl', repoUrl);
  if (branch) query.set('branch', branch);
  if (projectId) query.set('projectId', projectId);
  return fetchResource({
    fallback: [] as ScmCommit[],
    endpoint: `/scm/commits?${query.toString()}`,
    label: 'fetchScmCommits',
  });
};

export type PromoteCanaryResult = {
  operation?: { id: string; status: string };
  error?: string;
  violations?: DeployPolicyViolation[];
};

export const promoteCanary = async (
  serviceId: string,
  environment: string,
): Promise<PromoteCanaryResult> => {
  const response = await apiClient.post<{ operation: { id: string; status: string } }>(
    `/services/${serviceId}/promote-canary`,
    { environment },
    {
      requestSchema: promoteCanaryRequestSchema,
      responseSchema: promoteCanaryResponseSchema,
    },
  );
  if (response.error) {
    return {
      error: response.error,
      violations: extractDeployPolicyViolations(response.errorBody),
    };
  }
  const operation = response.data?.operation;
  return operation ? { operation } : { error: 'No operation returned' };
};

export type PublishRuleTargetsResult = {
  success: boolean;
  error?: string;
  violations?: DeployPolicyViolation[];
};

export const publishRuleTargets = async (
  ruleId: string,
  payload: { internal: boolean; external: boolean; environment: string },
): Promise<PublishRuleTargetsResult> => {
  const response = await apiClient.post(`/rules/${ruleId}/publish`, payload);
  if (response.error) {
    return {
      success: false,
      error: response.error,
      violations: extractDeployPolicyViolations(response.errorBody),
    };
  }
  return { success: true };
};

export const fetchRuleDeploys = async (): Promise<RuleDeploy[]> =>
  fetchResource({ fallback: [] as RuleDeploy[], endpoint: '/rule-deploys', label: 'fetchRuleDeploys' });

export const fetchServiceGovernanceEvents = async (serviceId: string): Promise<AuditLogEntry[]> =>
  fetchResource({
    fallback: [] as AuditLogEntry[],
    endpoint: `/services/${serviceId}/governance-events`,
    label: 'fetchServiceGovernanceEvents',
  });

export const fetchServiceDeployPolicyCheck = async (
  serviceId: string,
  environment: string,
  version?: string,
): Promise<DeployPolicyPreflight | null> => {
  const query = new URLSearchParams();
  query.set('environment', environment);
  if (version) {
    query.set('version', version);
  }
  const result = await fetchResource<DeployPolicyPreflight | null>({
    fallback: null,
    endpoint: `/services/${serviceId}/deploy-policy-check?${query.toString()}`,
    label: 'fetchServiceDeployPolicyCheck',
  });
  if (!result) return null;
  return {
    ...result,
    violations: Array.isArray(result.violations) ? result.violations : [],
    exceptionsApplied: Array.isArray(result.exceptionsApplied) ? result.exceptionsApplied : [],
  };
};

export type ServiceDesiredStateExportResult = {
  exportData: ServiceDesiredStateExport | null;
  error: string | null;
  code?: string | null;
};

export const fetchServiceDesiredStateExport = async (
  serviceId: string,
): Promise<ServiceDesiredStateExportResult> => {
  const response = await apiClient.get<ServiceDesiredStateExport>(`/services/${serviceId}/desired-state`);
  if (response.error || !response.data) {
    clientLogger.warn('api.fetchServiceDesiredStateExport', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      exportData: null,
      error: response.error || 'Failed to export desired state',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { exportData: response.data, error: null, code: null };
};

export type ServiceDesiredStateValidationResult = {
  validation: ServiceDesiredStateValidation | null;
  error: string | null;
  code?: string | null;
};

export const fetchServiceDesiredStateValidation = async (
  serviceId: string,
): Promise<ServiceDesiredStateValidationResult> => {
  const response = await apiClient.get<ServiceDesiredStateValidation>(`/services/${serviceId}/desired-state/validation`);
  if (response.error || !response.data) {
    clientLogger.warn('api.fetchServiceDesiredStateValidation', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      validation: null,
      error: response.error || 'Failed to validate desired state',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { validation: response.data, error: null, code: null };
};

export type ServiceGitOpsPullRequestResult = {
  pullRequest: ServiceGitOpsPullRequest | null;
  error: string | null;
  code?: string | null;
};

export const createServiceGitOpsPullRequest = async (
  serviceId: string,
  payload?: {
    baseBranch?: string;
    filePath?: string;
    title?: string;
    body?: string;
    commitMessage?: string;
  },
): Promise<ServiceGitOpsPullRequestResult> => {
  const response = await apiClient.post<ServiceGitOpsPullRequest>(
    `/services/${serviceId}/gitops/pull-requests`,
    payload ?? {},
  );
  if (response.error || !response.data) {
    clientLogger.warn('api.createServiceGitOpsPullRequest', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      pullRequest: null,
      error: response.error || 'Failed to create GitOps pull request',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { pullRequest: response.data, error: null, code: null };
};

export const createServiceArgoCDGitOpsPullRequest = async (
  serviceId: string,
  payload?: {
    baseBranch?: string;
    title?: string;
    body?: string;
    commitMessage?: string;
  },
): Promise<ServiceGitOpsPullRequestResult> => {
  const response = await apiClient.post<ServiceGitOpsPullRequest>(
    `/services/${serviceId}/gitops/argocd/pull-requests`,
    payload ?? {},
  );
  if (response.error || !response.data) {
    clientLogger.warn('api.createServiceArgoCDGitOpsPullRequest', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      pullRequest: null,
      error: response.error || 'Failed to create Argo CD GitOps pull request',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { pullRequest: response.data, error: null, code: null };
};

export const createServiceFluxGitOpsPullRequest = async (
  serviceId: string,
  payload?: {
    baseBranch?: string;
    title?: string;
    body?: string;
    commitMessage?: string;
  },
): Promise<ServiceGitOpsPullRequestResult> => {
  const response = await apiClient.post<ServiceGitOpsPullRequest>(
    `/services/${serviceId}/gitops/flux/pull-requests`,
    payload ?? {},
  );
  if (response.error || !response.data) {
    clientLogger.warn('api.createServiceFluxGitOpsPullRequest', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      pullRequest: null,
      error: response.error || 'Failed to create Flux GitOps pull request',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { pullRequest: response.data, error: null, code: null };
};

export type ServiceGitOpsDriftResult = {
  drift: ServiceGitOpsDriftStatus | null;
  error: string | null;
  code?: string | null;
};

export type ServiceGitOpsRepositoryPolicyCheckResult = {
  policyCheck: ServiceGitOpsRepositoryPolicyCheck | null;
  error: string | null;
  code?: string | null;
};

export type ServiceGitOpsLayoutPresetsResult = {
  presets: ServiceGitOpsLayoutPreset[];
  error: string | null;
  code?: string | null;
};

export type ServiceGitOpsTimelineResult = {
  events: ServiceGitOpsTimelineEvent[];
  error: string | null;
  code?: string | null;
};

export const fetchServiceGitOpsDrift = async (
  serviceId: string,
): Promise<ServiceGitOpsDriftResult> => {
  const response = await apiClient.get<ServiceGitOpsDriftStatus>(`/services/${serviceId}/gitops/drift`);
  if (response.error || !response.data) {
    clientLogger.warn('api.fetchServiceGitOpsDrift', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      drift: null,
      error: response.error || 'Failed to check GitOps drift',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { drift: response.data, error: null, code: null };
};

export const fetchServiceGitOpsRepositoryPolicyCheck = async (
  serviceId: string,
): Promise<ServiceGitOpsRepositoryPolicyCheckResult> => {
  const response = await apiClient.get<ServiceGitOpsRepositoryPolicyCheck>(`/services/${serviceId}/gitops/repository-policy-check`);
  if (response.error || !response.data) {
    clientLogger.warn('api.fetchServiceGitOpsRepositoryPolicyCheck', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      policyCheck: null,
      error: response.error || 'Failed to evaluate GitOps repository policy',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { policyCheck: response.data, error: null, code: null };
};

export const fetchServiceGitOpsLayoutPresets = async (
  serviceId: string,
): Promise<ServiceGitOpsLayoutPresetsResult> => {
  const response = await apiClient.get<ServiceGitOpsLayoutPreset[]>(`/services/${serviceId}/gitops/layout-presets`);
  if (response.error || !response.data) {
    clientLogger.warn('api.fetchServiceGitOpsLayoutPresets', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      presets: [],
      error: response.error || 'Failed to load GitOps layout presets',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { presets: response.data, error: null, code: null };
};

export const fetchServiceGitOpsTimeline = async (
  serviceId: string,
): Promise<ServiceGitOpsTimelineResult> => {
  const response = await apiClient.get<ServiceGitOpsTimelineEvent[]>(`/services/${serviceId}/gitops/timeline`);
  if (response.error || !response.data) {
    clientLogger.warn('api.fetchServiceGitOpsTimeline', 'Request failed', { error: response.error, serviceId });
    const errorBody =
      typeof response.errorBody === 'object' && response.errorBody !== null
        ? (response.errorBody as Record<string, unknown>)
        : null;
    return {
      events: [],
      error: response.error || 'Failed to load GitOps timeline',
      code: typeof errorBody?.code === 'string' ? errorBody.code : null,
    };
  }
  return { events: response.data, error: null, code: null };
};

export const fetchRulePublishPolicyCheck = async (
  ruleId: string,
  payload: { environment: string; internal: boolean; external: boolean },
): Promise<RulePublishPolicyPreflight | null> => {
  const query = new URLSearchParams();
  query.set('environment', payload.environment);
  if (payload.internal) {
    query.set('internal', 'true');
  }
  if (payload.external) {
    query.set('external', 'true');
  }
  return fetchResource({
    fallback: null,
    endpoint: `/rules/${ruleId}/publish-policy-check?${query.toString()}`,
    label: 'fetchRulePublishPolicyCheck',
  });
};

export const fetchRules = async (): Promise<ManagedRule[]> =>
  fetchResource({ fallback: EMPTY_RULES, endpoint: '/rules', label: 'fetchRules' });

export const createRule = async (
  payload: Partial<ManagedRule> & { internal?: boolean; external?: boolean },
): Promise<ManagedRule | null> => {
  const serviceId = (payload as Partial<ManagedRule>).serviceId;
  const endpoint = serviceId ? `/services/${serviceId}/rules` : '/rules';
  const response = await apiClient.post<ManagedRule>(endpoint, payload);
  if (response.error || !response.data) {
    clientLogger.warn('api.createRule', 'Request failed', { error: response.error });
    return null;
  }
  return response.data;
};

export const updateRule = async (ruleId: string, payload: Partial<ManagedRule>): Promise<ManagedRule | null> => {
  const response = await apiClient.put<ManagedRule>(`/rules/${ruleId}`, payload);
  if (response.error || !response.data) {
    clientLogger.warn('api.updateRule', 'Request failed', { error: response.error });
    return null;
  }
  return response.data;
};

export const deleteRule = async (ruleId: string): Promise<boolean> =>
  deleteResource(`/rules/${ruleId}`, 'deleteRule');

export const fetchEnvironments = async (): Promise<EnvironmentConfig[]> => {
  const fallback = getEnvironmentConfigs();
  const response = await apiClient.get<EnvironmentConfig[]>('/environments');
  if (!response.error && response.data) {
    saveEnvironmentConfigs(response.data);
    return getEnvironmentConfigs();
  }
  return fallback;
};

export interface EnvironmentLockStatus {
  environmentId: string;
  namespace: string;
  locked: boolean;
  deployCount: number;
  workerCount: number;
  reason: string;
}

export const fetchEnvironmentLock = async (envId: string): Promise<EnvironmentLockStatus> => {
  const fallback: EnvironmentLockStatus = {
    environmentId: envId,
    namespace: '',
    locked: false,
    deployCount: 0,
    workerCount: 0,
    reason: '',
  };
  const response = await apiClient.get<EnvironmentLockStatus>(`/environments/${envId}/lock`);
  if (!response.error && response.data) {
    return response.data;
  }
  return fallback;
};

export const fetchProfile = async (): Promise<UserProfile> =>
  fetchResource({ fallback: EMPTY_PROFILE, endpoint: '/profile', label: 'fetchProfile' });

export const fetchPlatformSettings = async (): Promise<PlatformSettings> =>
  fetchResource({
    fallback: EMPTY_PLATFORM_SETTINGS,
    endpoint: '/settings/platform',
    label: 'fetchPlatformSettings',
  });

const buildMetricTimestamps = (from?: Date, to?: Date): string[] => {
  if (!from || !to) return [];
  if (from > to) {
    return buildMetricTimestamps(to, from);
  }
  const timestamps: string[] = [];
  const cursor = new Date(from);
  const rangeMinutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60)));
  const stepMinutes = Math.max(1, Math.round(rangeMinutes / 60));
  while (cursor <= to) {
    timestamps.push(cursor.toISOString());
    cursor.setMinutes(cursor.getMinutes() + stepMinutes);
  }
  if (timestamps.length === 0) {
    timestamps.push(from.toISOString());
  }
  return timestamps;
};

export const fetchMetrics = async (serviceId: string, from?: Date, to?: Date, environment?: string): Promise<Metrics> => {
  const timestamps = buildMetricTimestamps(from, to);
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString());
  if (to) params.set('to', to.toISOString());
  // Environment is required - fail fast if not provided
  if (!environment) {
    clientLogger.warn('api.fetchMetrics', 'Called without required environment');
    return {
      serviceId,
      timestamps,
      cpu: timestamps.map(() => 0),
      memory: timestamps.map(() => 0),
      latencyP95: timestamps.map(() => 0),
      requests: timestamps.map(() => 0),
      statusCodes: {
        '2xx': timestamps.map(() => 0),
        '4xx': timestamps.map(() => 0),
        '5xx': timestamps.map(() => 0),
      },
    };
  }
  params.set('environment', environment);
  const endpoint = `/services/${serviceId}/metrics?${params.toString()}`;
  const fallback: Metrics = {
    serviceId,
    environment,
    timestamps,
    cpu: timestamps.map(() => 0),
    memory: timestamps.map(() => 0),
    latencyP95: timestamps.map(() => 0),
    requests: timestamps.map(() => 0),
    statusCodes: {
      '2xx': timestamps.map(() => 0),
      '4xx': timestamps.map(() => 0),
      '5xx': timestamps.map(() => 0),
    },
  };
  return resolveResponse(apiClient.get<Metrics>(endpoint), fallback, 'fetchMetrics');
};

export const fetchServiceLogs = async (
  serviceId: string,
  options?: { from?: Date; to?: Date; limit?: number; environment?: string; pod?: string; container?: string }
): Promise<LogEntry[]> => {
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from.toISOString());
  if (options?.to) params.set('to', options.to.toISOString());
  if (options?.limit) params.set('limit', String(options.limit));
  // Environment is required
  if (!options?.environment) {
    clientLogger.warn('api.fetchServiceLogs', 'Called without required environment');
    return EMPTY_LOGS;
  }
  params.set('environment', options.environment);
  if (options?.pod) params.set('pod', options.pod);
  if (options?.container) params.set('container', options.container);
  const endpoint = `/services/${serviceId}/logs?${params.toString()}`;
  return fetchResource({ fallback: EMPTY_LOGS, endpoint, label: 'fetchServiceLogs' });
};

export const fetchServicePods = async (serviceId: string, environment: string): Promise<string[]> => {
  if (!environment) {
    clientLogger.warn('api.fetchServicePods', 'Called without required environment');
    return [];
  }
  const params = new URLSearchParams();
  params.set('environment', environment);
  const endpoint = `/services/${serviceId}/pods?${params.toString()}`;
  const response = await apiClient.get<{ pods: string[]; namespace: string; error?: string }>(endpoint);
  if (response.error || !response.data) {
    return [];
  }
  return response.data.pods ?? [];
};

export const fetchObservabilityHealth = async (): Promise<{
  status: string;
  prometheus: { healthy: boolean; url: string; error?: string };
  loki: { healthy: boolean; url: string; error?: string };
}> => {
  const fallback = {
    status: 'unknown',
    prometheus: { healthy: false, url: '', error: 'Not fetched' },
    loki: { healthy: false, url: '', error: 'Not fetched' },
  };
  return resolveResponse(apiClient.get('/observability/health'), fallback, 'fetchObservabilityHealth');
};

export const fetchControlPlaneMetrics = async (): Promise<ControlPlaneMetrics> => {
  const fallback: ControlPlaneMetrics = {
    version: '1',
    queue: {
      queueName: 'releasea.worker',
      deadLetterEnabled: false,
      queuedOperations: 0,
      dispatchingOperations: 0,
      dispatchFailedOperations: 0,
      staleQueuedOperations: 0,
      recentDispatchFailures: 0,
      status: 'review',
      summary: 'Control plane metrics not loaded.',
    },
  };
  return resolveResponse(apiClient.get('/observability/control-plane'), fallback, 'fetchControlPlaneMetrics');
};

export const createProject = async (payload: {
  name: string;
  slug: string;
  description: string;
  teamId: string;
  runbookUrl?: string;
  alertChannel?: string;
  costCenter?: string;
  defaultEnvironment?: Environment;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  serviceTier?: 'standard' | 'business-critical' | 'mission-critical';
  scmCredentialId?: string;
  registryCredentialId?: string;
}): Promise<Project> => {
  const now = new Date().toISOString();
  const fallback: Project = {
    id: `proj-${Date.now()}`,
    name: payload.name,
    slug: payload.slug,
    description: payload.description,
    teamId: payload.teamId,
    runbookUrl: payload.runbookUrl,
    alertChannel: payload.alertChannel,
    costCenter: payload.costCenter,
    defaultEnvironment: payload.defaultEnvironment,
    dataClassification: payload.dataClassification,
    serviceTier: payload.serviceTier,
    scmCredentialId: payload.scmCredentialId,
    registryCredentialId: payload.registryCredentialId,
    createdAt: now,
    updatedAt: now,
    services: [],
  };
  return postResource({ fallback, endpoint: '/projects', payload, label: 'createProject' });
};

export const createService = async (payload: Partial<Service>): Promise<Service> => {
  const now = new Date().toISOString();
  const fallback: Service = {
    id: `svc-${Date.now()}`,
    name: payload.name ?? 'new-service',
    type: payload.type ?? 'microservice',
    status: payload.status ?? 'pending',
    managementMode: payload.managementMode ?? 'managed',
    projectId: payload.projectId ?? 'proj-1',
    replicas: payload.replicas ?? 1,
    cpu: payload.cpu ?? 40,
    memory: payload.memory ?? 55,
    createdAt: now,
    environment: payload.environment ?? {},
    ruleIds: payload.ruleIds ?? [],
    ...payload,
  };
  return postResource({ fallback, endpoint: '/services', payload, label: 'createService' });
};

export const updateService = async (serviceId: string, payload: Partial<Service>): Promise<Service> => {
  const now = new Date().toISOString();
  const fallback: Service = {
    id: serviceId,
    name: payload.name ?? '',
    type: payload.type ?? 'microservice',
    status: payload.status ?? 'pending',
    managementMode: payload.managementMode ?? 'managed',
    projectId: payload.projectId ?? '',
    replicas: payload.replicas ?? 1,
    cpu: payload.cpu ?? 40,
    memory: payload.memory ?? 55,
    createdAt: now,
    environment: payload.environment ?? {},
    ruleIds: payload.ruleIds ?? [],
    ...payload,
  };
  return putResource({ fallback, endpoint: `/services/${serviceId}`, payload, label: 'updateService' });
};

export const updateWorker = async (workerId: string, payload: Partial<Worker>): Promise<Worker> => {
  const now = new Date().toISOString();
  const fallback: Worker = {
    id: workerId,
    name: payload.name ?? '',
    environment: payload.environment ?? 'dev',
    status: payload.status ?? 'online',
    tags: payload.tags ?? [],
    cluster: payload.cluster ?? '',
    namespacePrefix: payload.namespacePrefix ?? '',
    namespace: payload.namespace ?? '',
    version: payload.version ?? 'v0.0.0',
    lastHeartbeat: payload.lastHeartbeat ?? now,
    currentTask: payload.currentTask,
    tasksCompleted: payload.tasksCompleted ?? 0,
    registeredAt: payload.registeredAt ?? now,
    desiredAgents: payload.desiredAgents ?? 0,
    onlineAgents: payload.onlineAgents ?? 0,
    credentialId: payload.credentialId ?? '',
  };
  return putResource({ fallback, endpoint: `/workers/${workerId}`, payload, label: 'updateWorker' });
};

export const deleteWorker = async (workerId: string): Promise<boolean> =>
  deleteResource(`/workers/${workerId}`, 'deleteWorker');

export const deleteWorkerRegistration = async (registrationId: string): Promise<boolean> =>
  deleteResource(`/workers/registrations/${encodeURIComponent(registrationId)}`, 'deleteWorkerRegistration');

export const createWorkerRegistration = async (payload: WorkerRegistration): Promise<WorkerRegistration> =>
  postResource({
    fallback: payload,
    endpoint: '/workers/registrations',
    payload,
    label: 'createWorkerRegistration',
  });

export const restartWorker = async (workerId: string): Promise<boolean> =>
  resolveAction(apiClient.post(`/workers/${workerId}/restart`, {}), 'restartWorker');

export const createExternalEndpoint = async (payload: ExternalEndpoint): Promise<ExternalEndpoint> =>
  postResource({
    fallback: payload,
    endpoint: '/external-endpoints',
    payload,
    label: 'createExternalEndpoint',
  });

export const updateExternalEndpoint = async (
  endpointId: string,
  payload: Partial<ExternalEndpoint>,
): Promise<ExternalEndpoint> => {
  const now = new Date().toISOString();
  const fallback: ExternalEndpoint = {
    id: endpointId,
    name: payload.name ?? '',
    hostname: payload.hostname ?? '',
    port: payload.port ?? 443,
    protocol: payload.protocol ?? 'https',
    certificateName: payload.certificateName,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
  };
  return putResource({
    fallback,
    endpoint: `/external-endpoints/${endpointId}`,
    payload,
    label: 'updateExternalEndpoint',
  });
};

export const deleteExternalEndpoint = async (endpointId: string): Promise<boolean> =>
  deleteResource(`/external-endpoints/${endpointId}`, 'deleteExternalEndpoint');

export const updateProfile = async (payload: Partial<UserProfile>): Promise<UserProfile> => {
  const fallback: UserProfile = {
    id: payload.id ?? '',
    name: payload.name ?? '',
    email: payload.email ?? '',
    role: payload.role ?? 'developer',
    teamId: payload.teamId ?? '',
    teamName: payload.teamName ?? '',
    avatar: payload.avatar,
    identityProvider: payload.identityProvider,
    twoFactorEnabled: payload.twoFactorEnabled ?? false,
    connectedProviders: payload.connectedProviders ?? [],
    sessions: payload.sessions ?? [],
  };
  return putResource({ fallback, endpoint: '/profile', payload, label: 'updateProfile' });
};

export const changePassword = async (payload: { currentPassword: string; newPassword: string }): Promise<boolean> => {
  return resolveAction(apiClient.post('/profile/password', payload), 'changePassword');
};

export const revokeSession = async (sessionId: string): Promise<boolean> =>
  resolveAction(apiClient.delete(`/profile/sessions/${sessionId}`), 'revokeSession');

export const deleteAccount = async (): Promise<boolean> =>
  resolveAction(apiClient.delete('/profile'), 'deleteAccount');

export const updatePlatformSettings = async (payload: PlatformSettings): Promise<PlatformSettings> =>
  putResource({
    fallback: payload,
    endpoint: '/settings/platform',
    payload,
    label: 'updatePlatformSettings',
  });

export const authLogin = async (
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: AuthUser; token?: string }> => {
  const response = await apiClient.post<{ user: AuthUser; token: string }>(
    '/auth/login',
    { email, password },
    {
      requestSchema: authSessionRequestSchema,
      responseSchema: authSessionResponseSchema,
    },
  );
  if (response.error || !response.data?.user || !response.data?.token) {
    return { success: false, error: response.error ?? 'Login failed.' };
  }
  return { success: true, user: response.data.user, token: response.data.token };
};

export const authSignUp = async (
  name: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: AuthUser; token?: string }> => {
  const response = await apiClient.post<{ user: AuthUser; token: string }>(
    '/auth/signup',
    { name, email, password },
    {
      requestSchema: authSignUpRequestSchema,
      responseSchema: authSessionResponseSchema,
    },
  );
  if (response.error || !response.data?.user || !response.data?.token) {
    return { success: false, error: response.error ?? 'Failed to create account. Please try again.' };
  }
  return { success: true, user: response.data.user, token: response.data.token };
};

export const authRequestPasswordReset = async (
  email: string,
): Promise<{ success: boolean; error?: string; token?: string }> => {
  const response = await apiClient.post<{ token?: string }>('/auth/password/reset', { email });
  if (response.error) {
    return { success: false, error: response.error };
  }
  return { success: true, token: response.data?.token };
};

export const authValidatePasswordResetToken = async (
  token: string,
): Promise<{ valid: boolean; email?: string }> => {
  const response = await apiClient.get<{ valid: boolean; email?: string }>(
    `/auth/password/reset/validate?token=${encodeURIComponent(token)}`,
  );
  if (response.error || !response.data) {
    return { valid: false };
  }
  return response.data;
};

export const authConfirmPasswordReset = async (
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> => {
  const response = await apiClient.post('/auth/password/reset/confirm', { token, newPassword });
  if (response.error) {
    return { success: false, error: response.error };
  }
  return { success: true };
};

export const authLogout = async (): Promise<boolean> => {
  return resolveAction(apiClient.post('/auth/logout'), 'logout');
};

export type AuthSSOConfig = {
  enabled: boolean;
  provider?: string;
};

export const fetchAuthSSOConfig = async (): Promise<AuthSSOConfig> => {
  const response = await apiClient.get<AuthSSOConfig>('/auth/sso/config');
  if (response.error || !response.data) {
    return { enabled: false };
  }
  return response.data;
};

export const buildAuthSSOStartUrl = (redirect: string, from?: string): string => {
  const query = new URLSearchParams();
  query.set('redirect', redirect);
  if (from) {
    query.set('from', from);
  }
  return `${getApiUrl('/auth/sso/start')}?${query.toString()}`;
};

export const authExchangeSSOTicket = async (
  ticket: string,
): Promise<{ success: boolean; error?: string; user?: AuthUser; token?: string }> => {
  const response = await apiClient.post<{ user: AuthUser; token: string }>(
    '/auth/sso/exchange',
    { ticket },
    {
      requestSchema: authExchangeSSORequestSchema,
      responseSchema: authSessionResponseSchema,
    },
  );
  if (response.error || !response.data?.user || !response.data?.token) {
    return { success: false, error: response.error ?? 'SSO login failed.' };
  }
  return {
    success: true,
    user: response.data.user,
    token: response.data.token,
  };
};

// --- Runtime Profiles ---

import type { RuntimeProfile, RuntimeProfilePayload } from '@/types/runtime-profile';

const EMPTY_RUNTIME_PROFILES: RuntimeProfile[] = [];

export const fetchRuntimeProfiles = async (): Promise<RuntimeProfile[]> =>
  fetchResource({ fallback: EMPTY_RUNTIME_PROFILES, endpoint: '/runtime-profiles', label: 'fetchRuntimeProfiles' });

export const createRuntimeProfile = async (payload: RuntimeProfilePayload): Promise<RuntimeProfile> => {
  const now = new Date().toISOString();
  const fallback: RuntimeProfile = { id: `rp-${Date.now()}`, ...payload, createdAt: now, updatedAt: now };
  return postResource({ fallback, endpoint: '/runtime-profiles', payload, label: 'createRuntimeProfile' });
};

export const updateRuntimeProfile = async (id: string, payload: Partial<RuntimeProfilePayload>): Promise<RuntimeProfile> => {
  const now = new Date().toISOString();
  const fallback: RuntimeProfile = {
    id,
    name: payload.name ?? '',
    cpu: payload.cpu ?? '250m',
    cpuLimit: payload.cpuLimit ?? '500m',
    memory: payload.memory ?? '256Mi',
    memoryLimit: payload.memoryLimit ?? '512Mi',
    description: payload.description,
    createdAt: now,
    updatedAt: now,
  };
  return putResource({ fallback, endpoint: `/runtime-profiles/${id}`, payload, label: 'updateRuntimeProfile' });
};

export const deleteRuntimeProfile = async (id: string): Promise<boolean> =>
  deleteResource(`/runtime-profiles/${id}`, 'deleteRuntimeProfile');
