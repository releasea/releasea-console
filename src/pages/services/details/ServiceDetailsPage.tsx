import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ExternalLink, FileText, Rocket, Settings, ShieldCheck, Terminal } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBackLink } from '@/components/layout/PageBackLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceTypeIcon } from '@/components/ui/service-type-icon';
import {
  createRule,
  deleteRule,
  fetchDeploys,
  fetchGithubCommits,
  fetchRuleDeploys,
  fetchServiceLogs,
  fetchServicePods,
  fetchMetrics,
  fetchProjects,
  fetchRegistryCredentials,
  fetchRules,
  fetchRuntimeProfiles,
  fetchScmCredentials,
  fetchServices,
  fetchWorkers,
  fetchPlatformSettings,
  performAction,
  promoteCanary,
  updateRule,
} from '@/lib/data';
import type { GitCommit } from '@/lib/data';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { environmentsShareNamespace, getEnvironmentConfigs, getEnvironmentLabel } from '@/lib/environments';
import { useTablePagination } from '@/hooks/use-table-pagination';
import { apiClient } from '@/lib/api-client';
import { useSSEStream } from '@/lib/use-sse-stream';
import { sanitizeExternalURL } from '@/platform/security/data-security';
import { ServiceSettingsFormStoreProvider } from '@/forms/store/service-settings-form-store';
import {
  isFailedDeployStatus,
  isDeployActionBlockedStatus,
  isLiveDeployStatus,
  resolveServiceStatusForDisplay,
  isSuccessfulDeployStatus,
  normalizeDeployStatusValue,
  parseDeployTimestamp,
} from '@/lib/deploy-status';
import type {
  Deploy,
  DeployStrategyType,
  Environment,
  LogEntry,
  ManagedRule,
  Metrics,
  Project,
  RegistryCredential,
  RuleDeploy,
  RulePolicyConfig,
  RuleProtocol,
  RuleStatus,
  ScmCredential,
  SecretProvider,
  Service,
  ServiceStatusSnapshot,
  Worker,
} from '@/types/releasea';
import { ServiceDetailsDialogs } from './ServiceDetailsDialogs';
import { ConfirmPromoteCanaryModal } from '@/components/modals/ConfirmPromoteCanaryModal';
import { EventsTab, type ServiceEvent } from './tabs/EventsTab';
import { LogsTab } from './tabs/LogsTab';
import { MetricsTab } from './tabs/MetricsTab';
import { RulesTab } from './tabs/RulesTab';
import { SettingsTab } from './tabs/SettingsTab';
import { SummaryTab } from './tabs/SummaryTab';
import { buildGateways, getGatewayTargets, getPublicationLabel, LOG_LINE_LIMIT } from './constants';
import type { RuntimeProfile } from '@/types/runtime-profile';
import type { EnvVar, PublicationTargets, RuleRow, ServiceDetailsLocationState } from './types';

const FAST_POLL_INTERVAL_MS = 2500;
const FAST_POLL_GRACE_MS = 30_000;
const OPTIMISTIC_DEPLOY_TIMEOUT_MS = 20_000;
const WORKER_STALE_SECONDS = (() => {
  const parsed = Number.parseInt(import.meta.env.RELEASEA_WORKER_STALE_SECONDS ?? '90', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
})();
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }
  return fallback;
}

function parseGithubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  return { owner: match?.[1] ?? '', repo: match?.[2] ?? '' };
}

function readReplicaName(metadata?: Record<string, unknown>): string {
  if (typeof metadata?.replicaName === 'string') return metadata.replicaName;
  if (typeof metadata?.pod === 'string') return metadata.pod;
  return '';
}

function readContainerName(metadata?: Record<string, unknown>): string {
  if (typeof metadata?.container === 'string') return metadata.container;
  if (typeof metadata?.containerName === 'string') return metadata.containerName;
  return '';
}

function isWorkerAvailableForEnvironment(worker: Worker, environment: string): boolean {
  if (!worker || !environment) return false;
  if (!['online', 'busy', 'pending'].includes(worker.status)) return false;
  if ((worker.onlineAgents ?? 0) <= 0) return false;
  const workerEnvironment = worker.environment?.trim();
  if (!workerEnvironment) return false;
  if (!environmentsShareNamespace(workerEnvironment, environment)) return false;
  const lastHeartbeatMs = Date.parse(worker.lastHeartbeat ?? '');
  if (Number.isNaN(lastHeartbeatMs)) return false;
  const thresholdMs = Date.now() - WORKER_STALE_SECONDS * 1000;
  return lastHeartbeatMs >= thresholdMs;
}

function buildServiceSettingsHydrationKey(service: Service): string {
  return JSON.stringify({
    id: service.id,
    projectId: service.projectId,
    type: service.type,
    sourceType: service.sourceType ?? '',
    deployTemplateId: service.deployTemplateId ?? '',
    repoUrl: service.repoUrl ?? '',
    branch: service.branch ?? '',
    rootDir: service.rootDir ?? '',
    dockerImage: service.dockerImage ?? '',
    dockerContext: service.dockerContext ?? '',
    dockerfilePath: service.dockerfilePath ?? '',
    dockerCommand: service.dockerCommand ?? '',
    preDeployCommand: service.preDeployCommand ?? '',
    port: service.port ?? null,
    healthCheckPath: service.healthCheckPath ?? '',
    minReplicas: service.minReplicas ?? null,
    maxReplicas: service.maxReplicas ?? null,
    replicas: service.replicas ?? null,
    isActive: service.isActive ?? true,
    autoDeploy: service.autoDeploy ?? true,
    pauseOnIdle: service.pauseOnIdle ?? false,
    pauseIdleTimeoutSeconds: service.pauseIdleTimeoutSeconds ?? 3600,
    profileId: service.profileId ?? '',
    deploymentStrategy: service.deploymentStrategy ?? null,
    framework: service.framework ?? '',
    installCommand: service.installCommand ?? '',
    buildCommand: service.buildCommand ?? '',
    outputDir: service.outputDir ?? '',
    cacheTtl: service.cacheTtl ?? '',
    scheduleCron: service.scheduleCron ?? '',
    scheduleTimezone: service.scheduleTimezone ?? '',
    scheduleCommand: service.scheduleCommand ?? '',
    scheduleRetries: service.scheduleRetries ?? '',
    scheduleTimeout: service.scheduleTimeout ?? '',
    scmCredentialId: service.scmCredentialId ?? '',
    registryCredentialId: service.registryCredentialId ?? '',
    secretProviderId: service.secretProviderId ?? '',
    environment: service.environment ?? {},
  });
}

const ServiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [deployVersionOpen, setDeployVersionOpen] = useState(false);
  const [deployVersion, setDeployVersion] = useState('');
  const [confirmDeployOpen, setConfirmDeployOpen] = useState(false);
  const [pendingDeployVersion, setPendingDeployVersion] = useState<string | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [deployLogOpen, setDeployLogOpen] = useState(false);
  const [selectedDeployLog, setSelectedDeployLog] = useState<Deploy | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deleteRuleOpen, setDeleteRuleOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RuleRow | null>(null);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleAction, setNewRuleAction] = useState<RulePolicyConfig['action']>('allow');
  const [newRuleMethods, setNewRuleMethods] = useState<string[]>(['GET']);
  const [newRulePaths, setNewRulePaths] = useState<string[]>([]);
  const [newRulePathDraft, setNewRulePathDraft] = useState('');
  const [editRuleOpen, setEditRuleOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRuleName, setEditRuleName] = useState('');
  const [editRuleAction, setEditRuleAction] = useState<RulePolicyConfig['action']>('allow');
  const [editRuleMethods, setEditRuleMethods] = useState<string[]>(['GET']);
  const [editRulePaths, setEditRulePaths] = useState<string[]>(['/']);
  const [editRulePathDraft, setEditRulePathDraft] = useState('');
  const [copyRuleOpen, setCopyRuleOpen] = useState(false);
  const [copyRuleId, setCopyRuleId] = useState<string | null>(null);
  const [copyRuleEnvs, setCopyRuleEnvs] = useState<string[]>([]);
  const [publishRuleOpen, setPublishRuleOpen] = useState(false);
  const [publishRuleId, setPublishRuleId] = useState<string | null>(null);
  const [publishTargets, setPublishTargets] = useState<PublicationTargets>({ internal: false, external: false });
  const [newRulePublishTargets, setNewRulePublishTargets] = useState<PublicationTargets>({
    internal: false,
    external: false,
  });
  const [sourceType, setSourceType] = useState<'git' | 'docker'>('git');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [rootDir, setRootDir] = useState('.');
  const [dockerImage, setDockerImage] = useState('');
  const [dockerContext, setDockerContext] = useState('.');
  const [dockerfilePath, setDockerfilePath] = useState('./Dockerfile');
  const [dockerCommand, setDockerCommand] = useState('');
  const [preDeployCommand, setPreDeployCommand] = useState('');
  const [serviceScmCredentialId, setServiceScmCredentialId] = useState('inherit');
  const [serviceRegistryCredentialId, setServiceRegistryCredentialId] = useState('inherit');
  const [serviceSecretProviderId, setServiceSecretProviderId] = useState('inherit');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [deployStrategyType, setDeployStrategyType] = useState<DeployStrategyType>('rolling');
  const [canaryPercent, setCanaryPercent] = useState('10');
  const [blueGreenPrimary, setBlueGreenPrimary] = useState<'blue' | 'green'>('blue');
  const [servicePort, setServicePort] = useState('');
  const [healthCheckPath, setHealthCheckPath] = useState('/healthz');
  const [pauseOnIdle, setPauseOnIdle] = useState(false);
  const [pauseIdleTimeoutMinutes, setPauseIdleTimeoutMinutes] = useState('60');
  const [profileId, setProfileId] = useState('');
  const [profiles, setProfiles] = useState<RuntimeProfile[]>([]);
  const [minReplicas, setMinReplicas] = useState('1');
  const [maxReplicas, setMaxReplicas] = useState('3');
  const [viewEnv, setViewEnv] = useState<Environment>('prod');
  const [activeTab, setActiveTab] = useState('summary');
  const viewEnvInitialized = useRef(false);
  const hydratedServiceIdRef = useRef<string | null>(null);
  const settingsHydrationKeyRef = useRef('');
  const [projectId, setProjectId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [installCommand, setInstallCommand] = useState('npm install');
  const [outputDir, setOutputDir] = useState('dist');
  const [framework, setFramework] = useState('vite');
  const [cacheTtl, setCacheTtl] = useState('3600');
  const [scheduleCron, setScheduleCron] = useState('');
  const [scheduleTimezone, setScheduleTimezone] = useState('');
  const [scheduleCommand, setScheduleCommand] = useState('');
  const [scheduleRetries, setScheduleRetries] = useState('');
  const [scheduleTimeout, setScheduleTimeout] = useState('');

  const [isServiceActive, setIsServiceActive] = useState(true);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedReplica, setSelectedReplica] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [availablePods, setAvailablePods] = useState<string[]>([]);
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [podsLoading, setPodsLoading] = useState(false);
  const [containersLoading, setContainersLoading] = useState(false);
  const [metricsFrom, setMetricsFrom] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
  const [metricsTo, setMetricsTo] = useState(() => new Date());
  const [metricsToNow, setMetricsToNow] = useState(true);

  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [deploysData, setDeploysData] = useState<Deploy[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rules, setRules] = useState<ManagedRule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scmCredentials, setScmCredentials] = useState<ScmCredential[]>([]);
  const [registryCredentials, setRegistryCredentials] = useState<RegistryCredential[]>([]);
  const [secretProviders, setSecretProviders] = useState<SecretProvider[]>([]);
  const [defaultSecretProviderId, setDefaultSecretProviderId] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const metricsRequestTokenRef = useRef(0);
  const deployPoller = useRef<number | null>(null);
  const servicePoller = useRef<number | null>(null);
  const fastPollGraceUntilRef = useRef(0);
  const hadLiveDeployRef = useRef(false);
  const hadPendingRuleDeployRef = useRef(false);
  const hasLiveDeploysRef = useRef(false);
  const hasPendingRuleDeploysRef = useRef(false);
  const hasOptimisticQueuedDeployRef = useRef(false);
  const publishRuleSubmittingRef = useRef(false);
  const optimisticDeployTimeoutRef = useRef<number | null>(null);
  const [ruleDeploysData, setRuleDeploysData] = useState<RuleDeploy[]>([]);
  const [promoteCanaryInProgress, setPromoteCanaryInProgress] = useState(false);
  const [promoteCanaryOpen, setPromoteCanaryOpen] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [isFastPolling, setIsFastPolling] = useState(false);
  const [runtimeRefreshNonce, setRuntimeRefreshNonce] = useState(0);
  const [lastRealtimeSyncAt, setLastRealtimeSyncAt] = useState<number | null>(null);
  const [realtimeSyncError, setRealtimeSyncError] = useState<string | null>(null);
  const [optimisticQueuedDeploy, setOptimisticQueuedDeploy] = useState<{
    serviceId: string;
    environment: Environment;
  } | null>(null);

  const backTarget = (location.state as ServiceDetailsLocationState | null)?.from;
  const backLink = backTarget?.pathname ?? '/services';
  const backLabel = backTarget?.label ?? 'Services';
  const environmentOptions = getEnvironmentConfigs();

  useEffect(() => {
    setActiveTab('summary');
  }, [id]);

  useEffect(() => {
    hadLiveDeployRef.current = false;
    hadPendingRuleDeployRef.current = false;
    hasLiveDeploysRef.current = false;
    hasPendingRuleDeploysRef.current = false;
    hasOptimisticQueuedDeployRef.current = false;
    fastPollGraceUntilRef.current = 0;
    if (deployPoller.current) {
      window.clearInterval(deployPoller.current);
      deployPoller.current = null;
    }
    setIsFastPolling(false);
  }, [id, viewEnv]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      const [
        servicesData,
        workersData,
        deploysData,
        rulesData,
        ruleDeploysResult,
        projectsData,
        scmData,
        registryData,
        settingsData,
        profilesData,
      ] = await Promise.all([
        fetchServices(),
        fetchWorkers(),
        fetchDeploys(),
        fetchRules(),
        fetchRuleDeploys(),
        fetchProjects(),
        fetchScmCredentials(),
        fetchRegistryCredentials(),
        fetchPlatformSettings(),
        fetchRuntimeProfiles(),
      ]);
      if (!active) return;
      setServices(servicesData);
      setWorkers(workersData);
      setDeploysData(deploysData);
      setRuleDeploysData(ruleDeploysResult);
      setLogs([]);
      setRules(rulesData);
      setProjects(projectsData);
      setScmCredentials(scmData);
      setRegistryCredentials(registryData);
      setSecretProviders(settingsData.secrets?.providers ?? []);
      setDefaultSecretProviderId(settingsData.secrets?.defaultProviderId ?? '');
      setProfiles(profilesData);
      setLastRealtimeSyncAt(Date.now());
      setRealtimeSyncError(null);
      setIsLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const fetchRealtimeResource = useCallback(async <T,>(endpoint: string, label: string): Promise<T> => {
    const response = await apiClient.get<T>(endpoint);
    if (response.error || response.data == null) {
      throw new Error(response.error ?? `Failed to ${label}`);
    }
    return response.data;
  }, []);

  const markRealtimeSyncSuccess = useCallback(() => {
    setLastRealtimeSyncAt(Date.now());
    setRealtimeSyncError(null);
  }, []);

  const markRealtimeSyncFailure = useCallback((error: unknown, fallback: string) => {
    setRealtimeSyncError(errorMessage(error, fallback));
  }, []);

  const runRealtimeRefresh = useCallback(
    async (action: () => Promise<void>, fallback: string) => {
      try {
        await action();
        markRealtimeSyncSuccess();
        return true;
      } catch (error) {
        markRealtimeSyncFailure(error, fallback);
        return false;
      }
    },
    [markRealtimeSyncFailure, markRealtimeSyncSuccess],
  );

  const refreshServices = useCallback(async () => {
    const nextServices = await fetchRealtimeResource<Service[]>('/services', 'load services');
    setServices(nextServices);
  }, [fetchRealtimeResource]);

  const refreshWorkers = useCallback(async () => {
    const nextWorkers = await fetchRealtimeResource<Worker[]>('/workers?view=summary', 'load workers');
    setWorkers(nextWorkers);
  }, [fetchRealtimeResource]);

  const applyServiceStatusSnapshot = useCallback(
    (snapshot: ServiceStatusSnapshot) => {
      if (!snapshot?.service || !id || snapshot.service.id !== id) {
        return;
      }
      setServices((current) => {
        const next = current.filter((item) => item.id !== snapshot.service.id);
        return [snapshot.service, ...next];
      });
      setDeploysData(Array.isArray(snapshot.deploys) ? snapshot.deploys : []);
      setRules(Array.isArray(snapshot.rules) ? snapshot.rules : []);
      setRuleDeploysData(Array.isArray(snapshot.ruleDeploys) ? snapshot.ruleDeploys : []);
      markRealtimeSyncSuccess();
    },
    [id, markRealtimeSyncSuccess],
  );

  const fetchServiceStatusSnapshot = useCallback(async (): Promise<ServiceStatusSnapshot> => {
    if (!id) {
      throw new Error('Missing service ID');
    }
    const query = new URLSearchParams();
    if (viewEnv) {
      query.set('environment', viewEnv);
    }
    const suffix = query.toString();
    const endpoint = suffix ? `/services/${id}/status?${suffix}` : `/services/${id}/status`;
    return fetchRealtimeResource<ServiceStatusSnapshot>(endpoint, 'load service status');
  }, [fetchRealtimeResource, id, viewEnv]);

  const refreshRealtimeSnapshot = useCallback(async () => {
    const snapshot = await fetchServiceStatusSnapshot();
    applyServiceStatusSnapshot(snapshot);
  }, [applyServiceStatusSnapshot, fetchServiceStatusSnapshot]);

  useEffect(() => {
    return () => {
      if (deployPoller.current) {
        window.clearInterval(deployPoller.current);
      }
      if (servicePoller.current) {
        window.clearInterval(servicePoller.current);
      }
      if (optimisticDeployTimeoutRef.current) {
        window.clearTimeout(optimisticDeployTimeoutRef.current);
      }
    };
  }, []);

  const sseEndpoint = useMemo(() => {
    if (!id) return '';
    const query = new URLSearchParams();
    if (viewEnv) query.set('environment', viewEnv);
    const qs = query.toString();
    return qs ? `/services/${id}/status/stream?${qs}` : `/services/${id}/status/stream`;
  }, [id, viewEnv]);

  const { isConnected: isLiveSyncConnected } = useSSEStream<ServiceStatusSnapshot>({
    endpoint: sseEndpoint,
    onSnapshot: applyServiceStatusSnapshot,
    onDeleted: () => setRealtimeSyncError('Service no longer exists.'),
    onError: (msg) => markRealtimeSyncFailure(msg, msg),
    enabled: !!id,
  });

  const service = services.find((item) => item.id === id);
  const projectForService = projects.find((project) => project.id === service?.projectId);
  const scopedScmCredentials = useMemo(
    () =>
      scmCredentials.filter(
        (cred) =>
          cred.scope === 'platform' ||
          (cred.scope === 'project' && cred.projectId === projectForService?.id) ||
          (cred.scope === 'service' && cred.serviceId === service?.id)
      ),
    [scmCredentials, projectForService?.id, service?.id]
  );
  const scopedRegistryCredentials = useMemo(
    () =>
      registryCredentials.filter(
        (cred) =>
          cred.scope === 'platform' ||
          (cred.scope === 'project' && cred.projectId === projectForService?.id) ||
          (cred.scope === 'service' && cred.serviceId === service?.id)
      ),
    [registryCredentials, projectForService?.id, service?.id]
  );

  useEffect(() => {
    if (servicePoller.current) {
      window.clearInterval(servicePoller.current);
      servicePoller.current = null;
    }
    if (isFastPolling || isLiveSyncConnected) {
      return;
    }
    const interval = service?.status === 'creating' ? 5000 : 20000;
    servicePoller.current = window.setInterval(() => {
      void runRealtimeRefresh(
        refreshRealtimeSnapshot,
        'Unable to refresh service runtime status.',
      );
    }, interval);
    return () => {
      if (servicePoller.current) {
        window.clearInterval(servicePoller.current);
        servicePoller.current = null;
      }
    };
  }, [service?.status, isFastPolling, isLiveSyncConnected, refreshRealtimeSnapshot, runRealtimeRefresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void runRealtimeRefresh(refreshWorkers, 'Unable to refresh worker status.');
    }, isLiveSyncConnected ? 30000 : 10000);
    return () => {
      window.clearInterval(interval);
    };
  }, [isLiveSyncConnected, refreshWorkers, runRealtimeRefresh]);
  const credentialScopeLabel = (scope: string) => {
    if (scope === 'project') return 'Project';
    if (scope === 'service') return 'Service';
    return 'Platform';
  };
  const [serviceRules, setServiceRules] = useState<ManagedRule[]>([]);
  useEffect(() => {
    if (!id) {
      setServiceRules([]);
      return;
    }
    setServiceRules(rules.filter((rule) => rule.serviceId === id));
  }, [id, rules]);
  const deploys = deploysData.filter((deploy) => deploy.serviceId === id && (deploy.environment ? deploy.environment === viewEnv : true));
  const hasSuccessfulDeploy = deploys.some((deploy) => isSuccessfulDeployStatus(deploy.status));
  const deploysSorted = useMemo(() => {
    return [...deploys].sort(
      (a, b) =>
        parseDeployTimestamp(b.startedAt, b.createdAt, b.updatedAt) -
        parseDeployTimestamp(a.startedAt, a.createdAt, a.updatedAt),
    );
  }, [deploys]);
  const serviceRuleDeploys = useMemo(() => {
    return ruleDeploysData
      .filter((rd) => rd.serviceId === id && (rd.environment ? rd.environment === viewEnv : true))
      .sort((a, b) => {
        return (
          parseDeployTimestamp(b.startedAt, b.createdAt, b.updatedAt) -
          parseDeployTimestamp(a.startedAt, a.createdAt, a.updatedAt)
        );
      });
  }, [ruleDeploysData, id, viewEnv]);
  const hasPendingDeploys = useMemo(
    () =>
      deploysData.some(
        (deploy) =>
          deploy.serviceId === id &&
          (deploy.environment ? deploy.environment === viewEnv : true) &&
          isDeployActionBlockedStatus(deploy.status),
      ),
    [deploysData, id, viewEnv],
  );
  const hasLiveDeploys = useMemo(
    () =>
      deploysData.some(
        (deploy) =>
          deploy.serviceId === id &&
          (deploy.environment ? deploy.environment === viewEnv : true) &&
          isLiveDeployStatus(deploy.status),
      ),
    [deploysData, id, viewEnv],
  );
  const hasOptimisticQueuedDeploy = useMemo(
    () =>
      optimisticQueuedDeploy != null &&
      optimisticQueuedDeploy.serviceId === id &&
      optimisticQueuedDeploy.environment === viewEnv,
    [optimisticQueuedDeploy, id, viewEnv],
  );
  const hasActiveWorkerForViewEnv = useMemo(
    () => workers.some((worker) => isWorkerAvailableForEnvironment(worker, viewEnv)),
    [workers, viewEnv],
  );
  const isServiceCreating = service?.status === 'creating';
  const deployBusy = hasPendingDeploys || deployLoading || hasOptimisticQueuedDeploy;
  const deployActionTemporarilyBlocked = isServiceCreating || !hasActiveWorkerForViewEnv || deployBusy;
  const deployBlockedMessage = isServiceCreating
    ? 'Service creation is still in progress. Deploy is disabled until creation finishes.'
    : !hasActiveWorkerForViewEnv
      ? `No active worker is available for ${getEnvironmentLabel(viewEnv)}. Register and start a worker in this environment before deploying.`
      : 'Wait until scheduling, preparation, and deployment steps are done.';
  const hasPendingRuleDeploys = useMemo(
    () =>
      ruleDeploysData.some(
        (rd) =>
          rd.serviceId === id &&
          (rd.environment ? rd.environment === viewEnv : true) &&
          (rd.status === 'queued' || rd.status === 'in-progress'),
      ),
    [ruleDeploysData, id, viewEnv],
  );
  const ruleNameById = useMemo(() => {
    return new Map(serviceRules.map((rule) => [rule.id, rule.name]));
  }, [serviceRules]);
  const serviceEvents = useMemo(() => {
    const formatEventTime = (value?: string | null) => {
      const time = parseDeployTimestamp(value);
      if (time === 0) {
        return { time: 0, label: '--' };
      }
      return { time, label: format(new Date(time), 'MMM dd, yyyy HH:mm') };
    };
    const events: ServiceEvent[] = [];
    deploysSorted.forEach((deploy) => {
      const { time, label } = formatEventTime(deploy.startedAt ?? deploy.createdAt ?? deploy.updatedAt);
      events.push({
        id: `deploy:${deploy.id}`,
        kind: 'deploy',
        status: deploy.status,
        label: deploy.commit
          ? (deploy.commit.length > 8 ? deploy.commit.substring(0, 8) : deploy.commit)
          : '--',
        branch: deploy.branch || undefined,
        environment: deploy.environment,
        triggeredBy: deploy.triggeredBy,
        timeLabel: label,
        deploy,
        time,
      });
    });
    serviceRuleDeploys.forEach((ruleDeploy) => {
      const { time, label } = formatEventTime(ruleDeploy.startedAt ?? ruleDeploy.createdAt ?? ruleDeploy.updatedAt);
      events.push({
        id: `rule:${ruleDeploy.id}`,
        kind: 'rule-deploy',
        status: ruleDeploy.status,
        label: ruleNameById.get(ruleDeploy.ruleId) ?? ruleDeploy.ruleId,
        environment: ruleDeploy.environment,
        triggeredBy: ruleDeploy.triggeredBy,
        timeLabel: label,
        ruleDeploy,
        time,
      });
    });
    return events.sort((a, b) => b.time - a.time);
  }, [deploysSorted, ruleNameById, serviceRuleDeploys]);
  const eventsPagination = useTablePagination(serviceEvents.length);
  const visibleEvents = eventsPagination.slice(serviceEvents);
  useEffect(() => {
    if (optimisticDeployTimeoutRef.current) {
      window.clearTimeout(optimisticDeployTimeoutRef.current);
      optimisticDeployTimeoutRef.current = null;
    }
    if (!hasOptimisticQueuedDeploy || hasLiveDeploys) {
      return;
    }
    optimisticDeployTimeoutRef.current = window.setTimeout(() => {
      setOptimisticQueuedDeploy(null);
      setDeployLoading(false);
      toast({
        title: 'Deploy queue confirmation delayed',
        description: 'No deploy was confirmed yet. You can try again.',
      });
    }, OPTIMISTIC_DEPLOY_TIMEOUT_MS);
    return () => {
      if (optimisticDeployTimeoutRef.current) {
        window.clearTimeout(optimisticDeployTimeoutRef.current);
        optimisticDeployTimeoutRef.current = null;
      }
    };
  }, [hasLiveDeploys, hasOptimisticQueuedDeploy]);

  useEffect(() => {
    if (!id) {
      if (deployPoller.current) {
        window.clearInterval(deployPoller.current);
        deployPoller.current = null;
      }
      setIsFastPolling(false);
      return;
    }
    if (isLiveSyncConnected) {
      if (deployPoller.current) {
        window.clearInterval(deployPoller.current);
        deployPoller.current = null;
      }
      if (isFastPolling) {
        setIsFastPolling(false);
      }
      if (hasOptimisticQueuedDeploy && hasLiveDeploys) {
        setOptimisticQueuedDeploy(null);
      }
      if (deployLoading && (hasLiveDeploys || hasPendingRuleDeploys)) {
        setDeployLoading(false);
      }
      return;
    }

    const now = Date.now();
    const justFinishedDeploy = hadLiveDeployRef.current && !hasLiveDeploys;
    const justFinishedRuleDeploy = hadPendingRuleDeployRef.current && !hasPendingRuleDeploys;

    if (hasLiveDeploys || hasPendingRuleDeploys || justFinishedDeploy || justFinishedRuleDeploy) {
      fastPollGraceUntilRef.current = now + FAST_POLL_GRACE_MS;
    }

    if (justFinishedDeploy) {
      setRuntimeRefreshNonce((current) => current + 1);
    }

    hasLiveDeploysRef.current = hasLiveDeploys;
    hasPendingRuleDeploysRef.current = hasPendingRuleDeploys;
    hasOptimisticQueuedDeployRef.current = hasOptimisticQueuedDeploy;
    hadLiveDeployRef.current = hasLiveDeploys;
    hadPendingRuleDeployRef.current = hasPendingRuleDeploys;

    const shouldFastPoll =
      hasOptimisticQueuedDeploy ||
      hasLiveDeploys ||
      hasPendingRuleDeploys ||
      Date.now() < fastPollGraceUntilRef.current;

    if (!shouldFastPoll) {
      if (deployPoller.current) {
        window.clearInterval(deployPoller.current);
        deployPoller.current = null;
      }
      if (isFastPolling) {
        setIsFastPolling(false);
      }
      if (deployLoading && !hasOptimisticQueuedDeploy) {
        setDeployLoading(false);
      }
      return;
    }

    if (hasOptimisticQueuedDeploy && hasLiveDeploys) {
      setOptimisticQueuedDeploy(null);
    }
    if (deployLoading && (hasLiveDeploys || hasPendingRuleDeploys)) {
      setDeployLoading(false);
    }
    if (!isFastPolling) {
      setIsFastPolling(true);
    }

    const runFastRefresh = () =>
      runRealtimeRefresh(
        refreshRealtimeSnapshot,
        'Unable to refresh deploy status in real time.',
      );

    if (!deployPoller.current) {
      void runFastRefresh();
      deployPoller.current = window.setInterval(() => {
        const keepPolling =
          hasOptimisticQueuedDeployRef.current ||
          hasLiveDeploysRef.current ||
          hasPendingRuleDeploysRef.current ||
          Date.now() < fastPollGraceUntilRef.current;
        if (!keepPolling) {
          if (deployPoller.current) {
            window.clearInterval(deployPoller.current);
            deployPoller.current = null;
          }
          setIsFastPolling(false);
          return;
        }
        void runFastRefresh();
      }, FAST_POLL_INTERVAL_MS);
    }
  }, [
    deployLoading,
    hasLiveDeploys,
    hasOptimisticQueuedDeploy,
    hasPendingRuleDeploys,
    id,
    isLiveSyncConnected,
    isFastPolling,
    refreshRealtimeSnapshot,
    runRealtimeRefresh,
  ]);
  const environmentRules = useMemo(
    () => serviceRules.filter((rule) => rule.environment === viewEnv),
    [serviceRules, viewEnv],
  );
  const appUrls = useMemo(() => {
    if (!service) return [];
    const protocolOrder: Record<RuleProtocol, number> = { https: 0, http: 1, grpc: 2, tcp: 3 };
    const protocolsByTarget = {
      internal: new Set<RuleProtocol>(),
      external: new Set<RuleProtocol>(),
    };
    const activeRules = serviceRules.filter(
      (rule) =>
        rule.serviceId === service.id &&
        rule.environment === viewEnv &&
        rule.status !== 'draft',
    );
    for (const rule of activeRules) {
      const targets = getGatewayTargets(rule.gateways ?? []);
      if (targets.internal) {
        protocolsByTarget.internal.add(rule.protocol);
      }
      if (targets.external) {
        protocolsByTarget.external.add(rule.protocol);
      }
    }
    const buildUrls = (target: 'internal' | 'external', suffix: string) => {
      const protocols = Array.from(protocolsByTarget[target]).sort(
        (a, b) => (protocolOrder[a] ?? 99) - (protocolOrder[b] ?? 99),
      );
      return protocols.map((protocol) => ({
        ...sanitizeExternalURL(`${protocol}://${service.name}.releasea.${suffix}`),
        id: `${target}-${protocol}`,
        protocolLabel: protocol.toUpperCase(),
        targetLabel: target === 'internal' ? 'Internal' : 'External',
      }));
    };
    return [
      ...buildUrls('internal', 'internal'),
      ...buildUrls('external', 'external'),
    ];
  }, [service, serviceRules, viewEnv]);
  const editingRule = useMemo(
    () => serviceRules.find((rule) => rule.id === editingRuleId) ?? null,
    [serviceRules, editingRuleId],
  );
  const copyRule = useMemo(
    () => serviceRules.find((rule) => rule.id === copyRuleId) ?? null,
    [serviceRules, copyRuleId],
  );
  const publishRule = useMemo(
    () => serviceRules.find((rule) => rule.id === publishRuleId) ?? null,
    [serviceRules, publishRuleId],
  );
  useEffect(() => {
    if (!publishRule) return;
    setPublishTargets(getGatewayTargets(publishRule.gateways));
  }, [publishRule]);
  const rulesPagination = useTablePagination(environmentRules.length);
  const visibleServiceRules = rulesPagination.slice(environmentRules);
  const baseLogs = logs.filter((log) => log.serviceId === id);

  const refreshMetrics = useCallback(async () => {
    const serviceId = service?.id;
    if (!serviceId) {
      setMetrics(null);
      return;
    }
    const requestToken = ++metricsRequestTokenRef.current;
    const selectedWindowMs = Math.max(60_000, metricsTo.getTime() - metricsFrom.getTime());
    const effectiveTo = metricsToNow ? new Date() : metricsTo;
    const effectiveFrom = metricsToNow
      ? new Date(effectiveTo.getTime() - selectedWindowMs)
      : metricsFrom;
    const data = await fetchMetrics(serviceId, effectiveFrom, effectiveTo, viewEnv);
    if (requestToken !== metricsRequestTokenRef.current) {
      return;
    }
    setMetrics(data);
  }, [service?.id, metricsFrom, metricsTo, metricsToNow, viewEnv]);

  const handleMetricsRefresh = useCallback(async () => {
    await refreshMetrics();
  }, [refreshMetrics]);

  const handleMetricsTimeRangeChange = useCallback((from: Date, to: Date, toNow?: boolean) => {
    const nextToNow = Boolean(toNow);
    setMetricsFrom((current) => (current.getTime() === from.getTime() ? current : from));
    setMetricsTo((current) => (current.getTime() === to.getTime() ? current : to));
    setMetricsToNow((current) => (current === nextToNow ? current : nextToNow));
  }, []);

  // Metrics refreshes only on explicit range/env changes (or manual/interval refresh callback).
  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  // Re-sync snapshot when environment changes (stream reconnect also handles updates).
  useEffect(() => {
    if (!id || !viewEnv || isLiveSyncConnected) return;
    void runRealtimeRefresh(
      refreshRealtimeSnapshot,
      'Unable to refresh environment-specific deploy data.',
    );
  }, [id, isLiveSyncConnected, refreshRealtimeSnapshot, runRealtimeRefresh, viewEnv]);
  const deployHistory = deploysSorted;
  const latestDeploy = deployHistory[0];
  const latestLiveDeployStatus = useMemo(
    () =>
      hasOptimisticQueuedDeploy && !hasLiveDeploys
        ? 'requested'
        : deploysSorted.find((deploy) => isLiveDeployStatus(deploy.status))?.status ?? null,
    [deploysSorted, hasLiveDeploys, hasOptimisticQueuedDeploy],
  );
  const latestDeployStatus = useMemo(
    () => normalizeDeployStatusValue(deploysSorted[0]?.status) ?? null,
    [deploysSorted],
  );
  const serviceDisplayStatus = useMemo(
    () => {
      if (!service) {
        return 'pending';
      }
      if (!hasLiveDeploys && !hasSuccessfulDeploy && latestDeployStatus && isFailedDeployStatus(latestDeployStatus)) {
        return latestDeployStatus;
      }
      const resolved = resolveServiceStatusForDisplay({
        service,
        environment: viewEnv,
        latestDeployStatus: latestLiveDeployStatus,
      });
      if (!hasLiveDeploys && !hasSuccessfulDeploy && resolved === 'running') {
        return 'idle';
      }
      return resolved;
    },
    [service, hasLiveDeploys, hasSuccessfulDeploy, latestDeployStatus, viewEnv, latestLiveDeployStatus],
  );
  const versionOptions = commits.length > 0
    ? commits.map((c) => ({
        value: c.sha,
        label: c.sha.substring(0, 8),
        meta: `${c.message.substring(0, 60)} · ${c.author}`,
      }))
    : deployHistory
        .map((deploy) => {
          const commit = deploy.commit?.trim();
          if (!commit) return null;
          return {
            value: commit,
            label: commit.substring(0, 8),
            meta: `${deploy.branch ?? 'main'} · ${format(new Date(deploy.startedAt), 'MMM dd, yyyy HH:mm')}`,
          };
        })
        .filter((option): option is { value: string; label: string; meta: string } => option !== null);

  useEffect(() => {
    if (!service) return;
    const serviceChanged = hydratedServiceIdRef.current !== service.id;
    if (serviceChanged) {
      hydratedServiceIdRef.current = service.id;
      viewEnvInitialized.current = false;
      settingsHydrationKeyRef.current = '';
    }
    const hydrationKey = buildServiceSettingsHydrationKey(service);
    if (settingsHydrationKeyRef.current === hydrationKey) {
      return;
    }
    settingsHydrationKeyRef.current = hydrationKey;
    setProjectId(service.projectId);
    setServicePort(service.port ? String(service.port) : '');
    setProfileId(service.profileId ?? '');
    const serviceMinReplicas = service.minReplicas ?? service.replicas ?? 1;
    const serviceMaxReplicas = service.maxReplicas ?? Math.max(serviceMinReplicas, 3);
    setMinReplicas(String(serviceMinReplicas));
    setMaxReplicas(String(Math.max(serviceMinReplicas, serviceMaxReplicas)));
    setIsServiceActive(service.isActive ?? true);
    // Only set viewEnv and reset metrics/logs state on first load - preserve user's manual selection
    if (!viewEnvInitialized.current) {
      const defaultEnv = (deploysData.find((deploy) => deploy.serviceId === service.id && deploy.environment)?.environment ?? 'prod') as Environment;
      setViewEnv(defaultEnv);
      setSelectedReplica('');
      setSelectedContainer('');
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      setMetricsFrom(lastHour);
      setMetricsTo(now);
      setMetricsToNow(true);
      setLogsLoaded(false);
      viewEnvInitialized.current = true;
    }

    const strategy = service.deploymentStrategy;
    setDeployStrategyType(strategy?.type ?? 'rolling');
    if (strategy?.type === 'canary') {
      setCanaryPercent(String(strategy.canaryPercent ?? 10));
    } else {
      setCanaryPercent('10');
    }
    if (strategy?.type === 'blue-green') {
      setBlueGreenPrimary(strategy.blueGreenPrimary ?? 'blue');
    } else {
      setBlueGreenPrimary('blue');
    }

    const storedSourceType = service.sourceType === 'registry' ? 'docker' : service.sourceType;
    const prefersDocker = Boolean(service.dockerImage && service.dockerImage.trim().length > 0);
    setSourceType(storedSourceType ?? (prefersDocker ? 'docker' : 'git'));
    setRepoUrl(service.repoUrl ?? '');
    setBranch(service.branch ?? 'main');
    setRootDir(service.rootDir ?? '.');
    setDockerImage(service.dockerImage ?? '');
    setDockerContext(service.dockerContext ?? '.');
    setDockerfilePath(service.dockerfilePath ?? './Dockerfile');
    setDockerCommand(service.dockerCommand ?? '');
    setPreDeployCommand(service.preDeployCommand ?? '');
    setHealthCheckPath(service.healthCheckPath ?? '/healthz');
    setAutoDeploy(service.autoDeploy ?? true);
    setPauseOnIdle(service.type === 'microservice' ? (service.pauseOnIdle ?? false) : false);
    setPauseIdleTimeoutMinutes(
      String(
        Math.max(
          1,
          Math.ceil((service.pauseIdleTimeoutSeconds ?? 3600) / 60),
        ),
      ),
    );
    setServiceScmCredentialId(service.scmCredentialId || 'inherit');
    setServiceRegistryCredentialId(service.registryCredentialId || 'inherit');
    setServiceSecretProviderId(service.secretProviderId || 'inherit');
    if (service.type === 'static-site') {
      setFramework(service.framework ?? 'vite');
      setInstallCommand(service.installCommand ?? 'npm install');
      setBuildCommand(service.buildCommand ?? 'npm run build');
      setOutputDir(service.outputDir ?? 'dist');
      setCacheTtl(String(service.cacheTtl ?? '3600'));
    }
    setScheduleCron(service.scheduleCron ?? '');
    setScheduleTimezone(service.scheduleTimezone ?? '');
    setScheduleCommand(service.scheduleCommand ?? '');
    setScheduleRetries(service.scheduleRetries ? String(service.scheduleRetries) : '');
    setScheduleTimeout(service.scheduleTimeout ? String(service.scheduleTimeout) : '');

    const isSecretValue = (value: string) =>
      value.includes('***') || /^(vault|aws|gcp|secret):\/\//i.test(value);
    const initialEnvVars: EnvVar[] = Object.entries(service.environment).map(([key, value], index) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      return {
        id: `env-${service.id}-${index}`,
        key,
        value: stringValue,
        type: (isSecretValue(stringValue) ? 'secret' : 'plain') as 'plain' | 'secret',
      };
    });
    setEnvVars(initialEnvVars.length > 0 ? initialEnvVars : [
      { id: `env-${service.id}-0`, key: '', value: '', type: 'plain' as const },
    ]);
  }, [service, deploysData]);

  // Reset stale state when environment changes - ensures tabs show fresh data.
  useEffect(() => {
    setLogs([]);
    setLogsLoaded(false);
    setSelectedReplica('');
    setSelectedContainer('');
    setAvailablePods([]);
    setAvailableContainers([]);
  }, [viewEnv]);

  // Load available pods when environment changes
  useEffect(() => {
    if (!id || !viewEnv) return;
    let active = true;
    const loadPods = async () => {
      setPodsLoading(true);
      const pods = await fetchServicePods(id, viewEnv);
      if (!active) return;
      const sortedPods = [...pods].sort((a, b) => a.localeCompare(b));
      setAvailablePods(sortedPods);
      setSelectedReplica((current) => (current && sortedPods.includes(current) ? current : sortedPods[0] || ''));
      setPodsLoading(false);
    };
    loadPods();
    return () => {
      active = false;
    };
  }, [id, viewEnv]);

  useEffect(() => {
    if (!id || !viewEnv) return;
    const shouldRefreshPods = activeTab === 'logs' || hasLiveDeploys || isFastPolling;
    if (!shouldRefreshPods) return;
    let active = true;
    const refreshPods = async () => {
      const pods = await fetchServicePods(id, viewEnv);
      if (!active) return;
      const sortedPods = [...pods].sort((a, b) => a.localeCompare(b));
      setAvailablePods(sortedPods);
      setSelectedReplica((current) => (current && sortedPods.includes(current) ? current : sortedPods[0] || ''));
    };
    void refreshPods();
    const interval = window.setInterval(() => {
      void refreshPods();
    }, hasLiveDeploys || isFastPolling ? 3000 : 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeTab, hasLiveDeploys, id, isFastPolling, viewEnv]);

  useEffect(() => {
    if (runtimeRefreshNonce === 0 || !id || !viewEnv) return;
    let active = true;
    const refreshRuntimeViews = async () => {
      const pods = await fetchServicePods(id, viewEnv);
      if (!active) return;
      const sortedPods = [...pods].sort((a, b) => a.localeCompare(b));
      setAvailablePods(sortedPods);
      const nextReplica =
        selectedReplica && sortedPods.includes(selectedReplica)
          ? selectedReplica
          : (sortedPods[0] ?? '');
      setSelectedReplica(nextReplica);

      if (logsLoaded && nextReplica) {
        const to = new Date();
        const from = new Date(to.getTime() - 15 * 60 * 1000);
        const runtimeLogs = await fetchServiceLogs(id, {
          from,
          to,
          limit: LOG_LINE_LIMIT,
          environment: viewEnv,
          pod: nextReplica,
          container: selectedContainer || undefined,
        });
        if (!active) return;
        setLogs(runtimeLogs);
      }

      await refreshMetrics();
    };
    void refreshRuntimeViews();
    return () => {
      active = false;
    };
  }, [
    id,
    logsLoaded,
    refreshMetrics,
    runtimeRefreshNonce,
    selectedContainer,
    selectedReplica,
    viewEnv,
  ]);

  useEffect(() => {
    if (!id || !viewEnv || !selectedReplica) {
      setAvailableContainers([]);
      setContainersLoading(false);
      return;
    }
    let active = true;
    const loadContainers = async () => {
      setContainersLoading(true);
      const to = new Date();
      const from = new Date(to.getTime() - 3 * 60 * 60 * 1000);
      const recentLogs = await fetchServiceLogs(id, {
        from,
        to,
        limit: 1000,
        environment: viewEnv,
        pod: selectedReplica,
      });
      if (!active) return;
      const containers = Array.from(
        new Set(
          recentLogs
            .map((entry) => readContainerName(entry.metadata))
            .filter((value): value is string => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));
      setAvailableContainers(containers);
      setSelectedContainer((current) => (current && containers.includes(current) ? current : containers[0] || ''));
      setContainersLoading(false);
    };
    void loadContainers();
    return () => {
      active = false;
    };
  }, [id, selectedReplica, viewEnv]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Loading service...</p>
        </div>
      </AppLayout>
    );
  }

  if (!service) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Service not found</p>
            <PageBackLink to={backLink} label={backLabel} className="mx-auto" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const envCount = envVars.filter((variable) => variable.key.trim().length > 0).length;
  const envCountLabel = `${envCount} ${envCount === 1 ? 'variable' : 'variables'}`;
  const viewEnvLabel = environmentOptions.find((env) => env.id === viewEnv)?.name ?? viewEnv;
  const lastRealtimeSyncLabel = lastRealtimeSyncAt
    ? format(new Date(lastRealtimeSyncAt), 'HH:mm:ss')
    : '--';
  const deployEnvLabel = (env?: string) =>
    environmentOptions.find((option) => option.id === env)?.name ?? (env ? env.toUpperCase() : '-');
  const latestVersionLabel = latestDeploy?.commit
    ? `Commit ${latestDeploy.commit.substring(0, 8)}`
    : service.repoUrl
      ? `Branch ${service.branch || 'main'} (latest commit)`
      : 'No deploys yet';


  const serviceTypeLabel = {
    microservice: 'Microservice',
    'static-site': 'Static site',
    worker: 'Worker',
  }[service.type];

  const deployStrategyLabel =
    deployStrategyType === 'canary'
      ? `Canary ${canaryPercent}%`
      : deployStrategyType === 'blue-green'
        ? `Blue/Green (${blueGreenPrimary})`
        : 'Rolling';

  const runtimeLabel = {
    microservice: 'Node.js 20',
    'static-site': 'External runtime',
    worker: 'Node.js 20',
  }[service.type];

  const isScheduledJob =
    service.deployTemplateId === 'tpl-cronjob' ||
    Boolean(service.scheduleCron || service.scheduleCommand);

  const selectedProfile = profiles.find((p) => p.id === profileId);
  const instanceLabel = selectedProfile
    ? `${selectedProfile.name} (${selectedProfile.cpu}, ${selectedProfile.memory})`
    : 'No profile';

  const repositoryUrl = sourceType === 'git' ? repoUrl : null;
  const servicePublicURL = sanitizeExternalURL(service.url ?? '');
  const dockerImageLabel = sourceType === 'docker' ? dockerImage : null;
  const branchName = branch;
  const dockerfileLabel = dockerfilePath;
  const dockerContextLabel = dockerContext;
  const healthPath = healthCheckPath || '/healthz';

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  // Summary metrics for Overview tab
  const cpuAvg = metrics?.cpu?.length ? Math.round(average(metrics.cpu)) : null;
  const cpuPeak = metrics?.cpu?.length ? Math.round(Math.max(...metrics.cpu)) : null;
  const memoryAvg = metrics?.memory?.length ? Math.round(average(metrics.memory)) : null;
  const memoryPeak = metrics?.memory?.length ? Math.round(Math.max(...metrics.memory)) : null;
  const latencyAvg = metrics?.latencyP95?.length
    ? Number(average(metrics.latencyP95).toFixed(1))
    : null;
  const latencyPeak = metrics?.latencyP95?.length
    ? Number(Math.max(...metrics.latencyP95).toFixed(1))
    : null;
  const requestsAvg = metrics?.requests?.length ? Math.round(average(metrics.requests)) : null;
  const requestsPeak = metrics?.requests?.length ? Math.round(Math.max(...metrics.requests)) : null;
  const cpuAvgLabel = cpuAvg === null ? '--' : `${cpuAvg}%`;
  const cpuPeakLabel = cpuPeak === null ? '--' : `${cpuPeak}%`;
  const memoryAvgLabel = memoryAvg === null ? '--' : `${memoryAvg}%`;
  const memoryPeakLabel = memoryPeak === null ? '--' : `${memoryPeak}%`;
  const latencyAvgLabel = latencyAvg === null ? '--' : `${latencyAvg} ms`;
  const latencyPeakLabel = latencyPeak === null ? '--' : `${latencyPeak} ms`;
  const formatRequests = (value: number | null) => {
    if (value === null) return '--';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${value}`;
  };
  const requestsAvgLabel = formatRequests(requestsAvg);
  const requestsPeakLabel = formatRequests(requestsPeak);

  const toKubernetesName = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  const deploymentName = toKubernetesName(service.name) || service.id;
  const replicaOptions = availablePods;
  const sortedLogs = [...baseLogs].sort(
    (a, b) => {
      const delta = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    },
  );
  const filteredLogs = sortedLogs.filter((log) => {
    if (selectedReplica && readReplicaName(log.metadata) !== selectedReplica) return false;
    if (selectedContainer && readContainerName(log.metadata) !== selectedContainer) return false;
    return true;
  });
  const visibleLogs = filteredLogs.slice(-LOG_LINE_LIMIT);
  const selectedContainerIsHistorical =
    selectedContainer.length > 0 && !availableContainers.includes(selectedContainer);

  const handleLoadLogs = async () => {
    if (!selectedReplica) {
      toast({
        title: 'Select an instance',
        description: 'Choose an instance before loading logs.',
      });
      return;
    }
    setLogsLoading(true);
    if (id) {
      const to = new Date();
      const recentWindowMs = selectedContainerIsHistorical ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
      const from = new Date(to.getTime() - recentWindowMs);
      const data = await fetchServiceLogs(id, {
        from,
        to,
        limit: LOG_LINE_LIMIT,
        environment: viewEnv,
        pod: selectedReplica,
        container: selectedContainer || undefined,
      });
      setLogs(data);
    }
    setLogsLoaded(true);
    setLogsLoading(false);
  };


  const addEnvVar = () => {
    const nextId = `env-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setEnvVars((vars) => [...vars, { id: nextId, key: '', value: '', type: 'plain' as const }]);
  };

  const updateEnvVar = (id: string, field: keyof EnvVar, value: string) => {
    setEnvVars((vars) => vars.map((variable) => (variable.id === id ? { ...variable, [field]: value } : variable)));
  };

  const removeEnvVar = (id: string) => {
    setEnvVars((vars) => vars.filter((variable) => variable.id !== id));
  };

  const normalizeSecretValue = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return trimmed;
    if (trimmed.includes('://')) return trimmed;
    return `secret://${trimmed}`;
  };

  const buildEnvironmentPayload = () =>
    envVars.reduce<Record<string, string>>((acc, variable) => {
      const key = variable.key.trim();
      if (!key) return acc;
      const rawValue = String(variable.value ?? '');
      const value =
        variable.type === 'secret' ? normalizeSecretValue(rawValue) : rawValue.trim();
      acc[key] = value;
      return acc;
    }, {});

  const handleSettingsSave = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setSettingsSaving(true);
    const previousStrategyType = service?.deploymentStrategy?.type ?? 'rolling';
    const previousCanaryPercent = Number(service?.deploymentStrategy?.canaryPercent ?? 10);
    const nextCanaryPercent = Number(canaryPercent) || 10;
    const strategyChanged =
      previousStrategyType !== deployStrategyType ||
      (deployStrategyType === 'canary' && previousCanaryPercent !== nextCanaryPercent);
    const parsedPort = Number(servicePort);
    const portValue = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : undefined;
    const parsedPauseIdleMinutes = Number(pauseIdleTimeoutMinutes);
    const pauseIdleTimeoutSeconds =
      Number.isFinite(parsedPauseIdleMinutes) && parsedPauseIdleMinutes > 0
        ? Math.max(60, Math.round(parsedPauseIdleMinutes * 60))
        : 3600;
    const scmCredentialId = serviceScmCredentialId === 'inherit' ? '' : serviceScmCredentialId;
    const registryCredentialId =
      serviceRegistryCredentialId === 'inherit' ? '' : serviceRegistryCredentialId;
    const secretProviderId =
      serviceSecretProviderId === 'inherit' ? '' : serviceSecretProviderId;
    const resolvedSourceType = sourceType === 'docker' ? 'registry' : 'git';
    const deployTemplateId = isScheduledJob
      ? 'tpl-cronjob'
      : (resolvedSourceType === 'registry' ? 'tpl-registry' : 'tpl-git');
    await performAction({
      endpoint: `/services/${id}`,
      method: 'PUT',
      payload: {
        port: portValue,
        sourceType: resolvedSourceType,
        repoUrl,
        branch,
        rootDir,
        dockerImage,
        dockerContext,
        dockerfilePath,
        dockerCommand,
        preDeployCommand,
        ...(service.type === 'static-site'
          ? {
              framework,
              installCommand,
              buildCommand,
              outputDir,
              cacheTtl,
            }
          : {}),
        ...(isScheduledJob
          ? {
              scheduleCron,
              scheduleTimezone,
              scheduleCommand,
              scheduleRetries,
              scheduleTimeout,
            }
          : {}),
        scmCredentialId,
        registryCredentialId,
        secretProviderId,
        deployTemplateId,
        autoDeploy,
        deployStrategyType,
        canaryPercent,
        blueGreenPrimary,
        servicePort,
        healthCheckPath,
        pauseOnIdle: service.type === 'microservice' ? pauseOnIdle : false,
        pauseIdleTimeoutSeconds: service.type === 'microservice' ? pauseIdleTimeoutSeconds : undefined,
        profileId: profileId || undefined,
        minReplicas,
        maxReplicas,
        scaleEnvironment: viewEnv,
        environment: buildEnvironmentPayload(),
      },
      label: 'updateServiceSettings',
    });
    setSettingsSaving(false);
    void runRealtimeRefresh(refreshRealtimeSnapshot, 'Unable to refresh service settings state.');
    const replicasChanged =
      String(service?.minReplicas ?? 1) !== minReplicas ||
      String(service?.maxReplicas ?? 3) !== maxReplicas;
    const profileChanged =
      service?.profileId !== profileId;
    if (replicasChanged || profileChanged) {
      toast({
        title: 'Scaling applied',
        description: 'Replica and resource changes are being applied immediately.',
      });
    } else {
      toast({
        title: 'Settings updated',
        description: 'Source, build, and strategy changes take effect on the next deploy.',
      });
    }
    if (strategyChanged) {
      toast({
        title: 'Traffic transition in progress',
        description: 'Routing is being updated to the new deploy strategy and may show brief instability.',
      });
    }
  };

  const handleDeleteService = async () => {
    if (!service) return;
    const response = await apiClient.delete<{ status?: string; warning?: string }>(`/services/${service.id}`);
    if (response.error) {
      toast({
        title: 'Failed to delete service',
        description: response.error,
        variant: 'destructive',
      });
      return;
    }
    if (response.data?.warning) {
      toast({
        title: 'Deletion queued',
        description: response.data.warning,
      });
    } else {
      toast({
        title: 'Deletion queued',
        description: `The service "${service.name}" is being deleted.`,
      });
    }
    navigate('/services');
  };

  const handleDeleteRuleOpenChange = (open: boolean) => {
    setDeleteRuleOpen(open);
    if (!open) {
      setSelectedRule(null);
    }
  };

  const handleDeleteRuleConfirm = async () => {
    if (!selectedRule) return;
    const success = await deleteRule(selectedRule.id);
    if (!success) {
      toast({ title: 'Failed to delete rule', description: 'Check API connectivity or rule status.', variant: 'destructive' });
      return;
    }
    setRules((current) => current.filter((rule) => rule.id !== selectedRule.id));
    setServiceRules((current) => current.filter((rule) => rule.id !== selectedRule.id));
    void runRealtimeRefresh(refreshRealtimeSnapshot, 'Unable to refresh rule deploy status.');
    toast({
      title: 'Rule deletion queued',
      description: `Rule "${selectedRule.name}" queued for deletion.`,
    });
  };

  const handleDeleteRuleFromEdit = () => {
    if (!editingRuleId) return;
    const rule = serviceRules.find((item) => item.id === editingRuleId);
    if (!rule) return;
    setEditRuleOpen(false);
    setSelectedRule(rule as RuleRow);
    setDeleteRuleOpen(true);
  };

  const applyRulePublication = (
    ruleId: string,
    targets: PublicationTargets,
    options?: { showToast?: boolean },
  ) => {
    const hasTargets = targets.internal || targets.external;
    const pendingStatus: RuleStatus = 'queued';
    const now = new Date().toISOString();
    const nextGatewaysByRuleId = new Map<string, string[]>();

    const applyToRule = (rule: ManagedRule) => {
      const nextGateways = buildGateways(rule.gateways, targets, rule.environment);
      nextGatewaysByRuleId.set(rule.id, nextGateways);
      return {
        ...rule,
        gateways: nextGateways,
        status: pendingStatus,
        updatedAt: now,
        lastPublishedAt: rule.lastPublishedAt,
      };
    };

    setServiceRules((current) => current.map((rule) => (rule.id === ruleId ? applyToRule(rule) : rule)));
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              gateways: nextGatewaysByRuleId.get(rule.id) ?? buildGateways(rule.gateways, targets, rule.environment),
              status: pendingStatus,
              updatedAt: now,
              lastPublishedAt: rule.lastPublishedAt,
            }
          : rule
      ),
    );

    if (options?.showToast !== false) {
      toast({
        title: hasTargets ? 'Publication queued' : 'Unpublish queued',
        description: hasTargets
          ? `Publishing to ${getPublicationLabel(targets).toLowerCase()}...`
          : 'Removing publication from all gateways...',
      });
    }
  };

  const openPublishRule = (rule: ManagedRule) => {
    setPublishRuleId(rule.id);
    setPublishTargets(getGatewayTargets(rule.gateways));
    setPublishRuleOpen(true);
  };

  const handleConfirmPublishRule = async () => {
    const ruleId = publishRuleId;
    if (!ruleId || publishRuleSubmittingRef.current) return;

    publishRuleSubmittingRef.current = true;
    const targetsSnapshot: PublicationTargets = {
      internal: publishTargets.internal,
      external: publishTargets.external,
    };
    const previousRule =
      serviceRules.find((rule) => rule.id === ruleId) ??
      rules.find((rule) => rule.id === ruleId) ??
      null;

    setPublishRuleOpen(false);
    setPublishRuleId(null);
    applyRulePublication(ruleId, targetsSnapshot);

    try {
      const success = await performAction({
        endpoint: `/rules/${ruleId}/publish`,
        method: 'POST',
        payload: { internal: targetsSnapshot.internal, external: targetsSnapshot.external, environment: viewEnv },
        label: 'updateRulePublication',
      });
      if (success) {
        void runRealtimeRefresh(refreshRealtimeSnapshot, 'Unable to refresh rule publication status.');
      } else {
        if (previousRule) {
          setServiceRules((current) => current.map((rule) => (rule.id === previousRule.id ? previousRule : rule)));
          setRules((current) => current.map((rule) => (rule.id === previousRule.id ? previousRule : rule)));
        }
        toast({
          title: 'Publication failed',
          description: 'Could not publish rule. Check worker connectivity.',
          variant: 'destructive',
        });
      }
    } finally {
      publishRuleSubmittingRef.current = false;
    }
  };

  const resetNewRuleForm = () => {
    setNewRuleName('');
    setNewRuleAction('allow');
    setNewRuleMethods(['GET']);
    setNewRulePaths([]);
    setNewRulePathDraft('');
    setNewRulePublishTargets({ internal: false, external: false });
  };

  const resetEditRuleForm = () => {
    setEditingRuleId(null);
    setEditRuleName('');
    setEditRuleAction('allow');
    setEditRuleMethods(['GET']);
    setEditRulePaths(['/']);
    setEditRulePathDraft('');
  };

  const toggleNewRuleMethod = (method: string) => {
    setNewRuleMethods((current) => {
      const next = current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method];
      return next.length ? next : current;
    });
  };

  const addNewRulePath = () => {
    let draft = newRulePathDraft.trim();
    if (!draft) return;
    if (!draft.startsWith('/')) {
      draft = `/${draft}`;
    }
    setNewRulePaths((current) => (current.includes(draft) ? current : [...current, draft]));
    setNewRulePathDraft('');
  };

  const removeNewRulePath = (path: string) => {
    setNewRulePaths((current) => current.filter((item) => item !== path));
  };

  const openEditRule = (rule: ManagedRule) => {
    setEditingRuleId(rule.id);
    setEditRuleName(rule.name);
    setEditRuleAction(rule.policy?.action ?? 'allow');
    setEditRuleMethods(rule.methods.length ? rule.methods : ['GET']);
    setEditRulePaths(rule.paths.length ? rule.paths : ['/']);
    setEditRulePathDraft('');
    setEditRuleOpen(true);
  };

  const toggleEditRuleMethod = (method: string) => {
    setEditRuleMethods((current) => {
      const next = current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method];
      return next.length ? next : current;
    });
  };

  const addEditRulePath = () => {
    const draft = editRulePathDraft.trim();
    if (!draft) return;
    setEditRulePaths((current) => (current.includes(draft) ? current : [...current, draft]));
    setEditRulePathDraft('');
  };

  const removeEditRulePath = (path: string) => {
    setEditRulePaths((current) => (current.length === 1 ? current : current.filter((item) => item !== path)));
  };

  const resetCopyRuleForm = () => {
    setCopyRuleId(null);
    setCopyRuleEnvs([]);
  };

  const openCopyRule = (rule: ManagedRule) => {
    setCopyRuleId(rule.id);
    setCopyRuleEnvs([]);
    setCopyRuleOpen(true);
  };

  const handleOpenCopyFromEdit = () => {
    if (!editingRule) return;
    setEditRuleOpen(false);
    openCopyRule(editingRule);
  };

  const toggleCopyRuleEnvironment = (envId: string) => {
    setCopyRuleEnvs((current) =>
      current.includes(envId) ? current.filter((item) => item !== envId) : [...current, envId],
    );
  };

  const handleSaveRuleEdits = async () => {
    if (!editingRuleId) return;
    const trimmedName = editRuleName.trim();
    if (!trimmedName) {
      toast({ title: 'Name required', description: 'Give the rule a name before saving.' });
      return;
    }
    if (editRulePaths.length === 0 || editRuleMethods.length === 0) {
      toast({ title: 'Incomplete rule', description: 'Select at least one method and one path.' });
      return;
    }

    const existingRule = serviceRules.find((r) => r.id === editingRuleId);
    const updated = await updateRule(editingRuleId, {
      name: trimmedName,
      methods: editRuleMethods,
      paths: editRulePaths,
      policy: {
        ...(existingRule?.policy ?? { timeoutMs: 1500, retries: 2, ipPolicy: 'open' }),
        action: editRuleAction,
      },
    });

    if (!updated) {
      toast({ title: 'Failed to update rule', description: 'Check API connectivity.', variant: 'destructive' });
      return;
    }

    setServiceRules((current) =>
      current.map((rule) => (rule.id === editingRuleId ? { ...rule, ...updated } : rule)),
    );
    setEditRuleOpen(false);
    resetEditRuleForm();
    toast({ title: 'Rule updated', description: 'Changes saved successfully.' });
  };

  const handleCopyRuleConfirm = async () => {
    if (!service || !copyRuleId) return;
    const sourceRule = serviceRules.find((rule) => rule.id === copyRuleId);
    if (!sourceRule) return;
    if (copyRuleEnvs.length === 0) {
      toast({ title: 'Select environments', description: 'Choose at least one environment to copy.' });
      return;
    }
    const existingByEnv = new Set(
      serviceRules
        .filter((rule) => rule.serviceId === service.id && rule.name === sourceRule.name)
        .map((rule) => rule.environment),
    );
    const envsToCreate = copyRuleEnvs.filter((envId) => !existingByEnv.has(envId as Environment));

    if (envsToCreate.length === 0) {
      toast({ title: 'Already exists', description: 'Rules with this name already exist in the selected environments.' });
      return;
    }

    const created: ManagedRule[] = [];
    for (const envId of envsToCreate) {
      const result = await createRule({
        name: sourceRule.name,
        serviceId: service.id,
        environment: envId as ManagedRule['environment'],
        hosts: sourceRule.hosts,
        paths: sourceRule.paths,
        methods: sourceRule.methods,
        protocol: sourceRule.protocol,
        port: sourceRule.port,
        policy: sourceRule.policy,
      });
      if (result) {
        created.push(result);
      }
    }

    if (created.length > 0) {
      setServiceRules((current) => [...current, ...created]);
    }
    setCopyRuleEnvs([]);
    setCopyRuleOpen(false);
    toast({
      title: 'Rule copied',
      description: `Copied to ${created.length} environment(s).`,
    });
  };

  const handleCreateRule = async () => {
    if (!service) return;
    const trimmedName = newRuleName.trim();
    if (!trimmedName) {
      toast({ title: 'Name required', description: 'Give the rule a name before saving.' });
      return;
    }
    if (newRulePaths.length === 0 || newRuleMethods.length === 0) {
      toast({ title: 'Incomplete rule', description: 'Select at least one method and one path.' });
      return;
    }

    const wantsPublish = newRulePublishTargets.internal || newRulePublishTargets.external;

    const created = await createRule({
      name: trimmedName,
      serviceId: service.id,
      environment: viewEnv as ManagedRule['environment'],
      hosts: [`${service.name}.svc.cluster.local`],
      paths: newRulePaths,
      methods: newRuleMethods,
      protocol: 'https',
      port: service.port ?? 80,
      policy: {
        action: newRuleAction,
        timeoutMs: 1500,
        retries: 2,
        ipPolicy: 'open',
      },
      internal: wantsPublish ? newRulePublishTargets.internal : false,
      external: wantsPublish ? newRulePublishTargets.external : false,
    });

    if (!created) {
      toast({ title: 'Failed to create rule', description: 'Check API connectivity.', variant: 'destructive' });
      return;
    }

    setServiceRules((current) => [...current, created]);
    setCreateRuleOpen(false);
    resetNewRuleForm();

    if (wantsPublish) {
      toast({
        title: 'Rule created & queued',
        description: `Publishing to ${getPublicationLabel(newRulePublishTargets).toLowerCase()} in ${getEnvironmentLabel(viewEnv)}.`,
      });
      void runRealtimeRefresh(
        refreshRealtimeSnapshot,
        'Unable to refresh new rule status.',
      );
    } else {
      toast({
        title: 'Rule created',
        description: `Saved as draft in ${getEnvironmentLabel(viewEnv)}.`,
      });
    }
  };

  const handleDeployLatest = async () => {
    if (deployActionTemporarilyBlocked) {
      toast({
        title: 'Deploy temporarily blocked',
        description: deployBlockedMessage,
      });
      return;
    }

    const isRegistrySource = service?.sourceType === 'registry' || sourceType === 'docker';
    let latestValue = isRegistrySource ? 'latest' : latestDeploy?.commit?.trim() ?? '';
    if (!isRegistrySource && !latestValue && service?.repoUrl) {
      const { owner, repo } = parseGithubUrl(service.repoUrl);
      if (owner && repo) {
        const result = await fetchGithubCommits(owner, repo, service.branch, service.projectId);
        setCommits(result);
        latestValue = result[0]?.sha?.trim() ?? '';
      }
    }
    if (!isRegistrySource && !latestValue && service?.repoUrl) {
      latestValue = 'head';
      toast({
        title: 'Using branch HEAD',
        description: 'Latest commit hash is temporarily unavailable. Deploy will use the current branch head.',
      });
    }
    if (!latestValue) {
      toast({
        title: 'Unable to resolve latest version',
        description: 'No commit was found for this repository. Select a specific commit before deploying.',
        variant: 'destructive',
      });
      return;
    }
    setPendingDeployVersion(latestValue);
    setConfirmDeployOpen(true);
  };

  const handleDeploySubmitStart = () => {
    if (!service) return;
    setDeployLoading(true);
    setOptimisticQueuedDeploy({
      serviceId: service.id,
      environment: viewEnv,
    });
  };

  const handleDeploySubmitError = (message?: string) => {
    setDeployLoading(false);
    setOptimisticQueuedDeploy(null);
    toast({
      title: 'Deploy failed',
      description: message || 'Unable to queue the deploy. Please try again.',
      variant: 'destructive',
    });
  };

  const handleConfirmDeploy = async () => {
    if (!pendingDeployVersion || !service) return;
    try {
      const synced = await runRealtimeRefresh(
        refreshRealtimeSnapshot,
        'Deploy was queued, but live status refresh failed.',
      );
      toast(
        synced
          ? {
              title: 'Deploy queued',
              description: `Deploying ${service.name} to ${getEnvironmentLabel(viewEnv)}...`,
            }
          : {
              title: 'Deploy queued',
              description: 'The deploy was requested, but status sync is delayed.',
            },
      );
    } finally {
      setPendingDeployVersion(null);
      setDeployLoading(false);
    }
  };

  const handleOpenVersionPicker = async () => {
    if (service?.repoUrl) {
      const { owner, repo } = parseGithubUrl(service.repoUrl);
      if (owner && repo) {
        const result = await fetchGithubCommits(owner, repo, service.branch, service.projectId);
        setCommits(result);
        if (result.length > 0) {
          setDeployVersion(result[0].sha);
        } else {
          setDeployVersion('');
        }
        setDeployVersionOpen(true);
        return;
      }
    }
    if (versionOptions.length > 0) {
      setDeployVersion(versionOptions[0].value);
    } else {
      setDeployVersion('');
    }
    setDeployVersionOpen(true);
  };

  const handlePromoteCanary = async () => {
    if (!service || deployStrategyType !== 'canary') return;
    setPromoteCanaryOpen(true);
  };

  const handleConfirmPromoteCanary = async () => {
    if (!service || deployStrategyType !== 'canary') return;
    setPromoteCanaryInProgress(true);
    try {
      const result = await promoteCanary(service.id, viewEnv);
      if (result.error) {
        toast({
          title: 'Promote failed',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Canary promoted successfully',
          description: `All traffic in ${getEnvironmentLabel(viewEnv)} is now being shifted to the new version. Your default canary percentage is preserved for the next deploy.`,
        });
        await runRealtimeRefresh(
          refreshRealtimeSnapshot,
          'Unable to refresh canary promotion status.',
        );
      }
    } finally {
      setPromoteCanaryInProgress(false);
    }
  };

  const handleDeploySpecific = () => {
    if (deployActionTemporarilyBlocked) {
      toast({
        title: 'Deploy temporarily blocked',
        description: deployBlockedMessage,
      });
      return;
    }
    if (!deployVersion) return;
    setPendingDeployVersion(deployVersion);
    setDeployVersionOpen(false);
    setConfirmDeployOpen(true);
  };

  const handleReplicaChange = (value: string) => {
    setSelectedReplica(value);
    setSelectedContainer('');
    if (logsLoaded) {
      setLogsLoaded(false);
    }
  };

  const handleContainerChange = (value: string) => {
    setSelectedContainer(value);
    if (logsLoaded) {
      setLogsLoaded(false);
    }
  };

  const handleDiscardSettings = () => {
    toast({
      title: 'Changes discarded',
      description: 'No settings were saved.',
    });
  };

  const handleToggleServiceActive = () => {
    const next = !isServiceActive;
    setIsServiceActive(next);
    toast({
      title: next ? 'Service activated' : 'Service deactivated',
      description: next
        ? 'Traffic is now allowed for this service.'
        : 'Traffic has been disabled for this service.',
    });
  };

  const handleOpenDeleteService = () => setDeleteOpen(true);

  const handleOpenDeployLog = (deploy: Deploy) => {
    setSelectedDeployLog(deploy);
    setDeployLogOpen(true);
  };

  const handleOpenRuleRuntimeLogs = () => {
    setActiveTab('logs');
    toast({
      title: 'Runtime logs by container',
      description: 'Rule publication events do not include own logs. Select a recent container (last 3h) to inspect runtime entries.',
    });
  };

  const handleOpenCreateRule = () => {
    resetNewRuleForm();
    setCreateRuleOpen(true);
  };

  const handleOpenDeleteRule = (rule: RuleRow) => {
    setSelectedRule(rule);
    setDeleteRuleOpen(true);
  };

  const settingsFormStore = {
    service,
    projects,
    projectId,
    onProjectChange: setProjectId,
    source: {
      type: sourceType,
      setType: setSourceType,
      repoUrl,
      setRepoUrl,
      branch,
      setBranch,
      rootDir,
      setRootDir,
      dockerImage,
      setDockerImage,
      dockerContext,
      setDockerContext,
      dockerfilePath,
      setDockerfilePath,
      dockerCommand,
      setDockerCommand,
      preDeployCommand,
      setPreDeployCommand,
      autoDeploy,
      setAutoDeploy,
    },
    runtime: {
      servicePort,
      setServicePort,
      healthCheckPath,
      setHealthCheckPath,
    },
    deployment: {
      deployStrategyType,
      setDeployStrategyType,
      canaryPercent,
      setCanaryPercent,
      blueGreenPrimary,
      setBlueGreenPrimary,
    },
    operations: {
      pauseOnIdle,
      setPauseOnIdle,
      pauseIdleTimeoutMinutes,
      setPauseIdleTimeoutMinutes,
      profileId,
      setProfileId,
      profiles,
      minReplicas,
      setMinReplicas,
      maxReplicas,
      setMaxReplicas,
    },
    envVars: {
      items: envVars,
      add: addEnvVar,
      update: updateEnvVar,
      remove: removeEnvVar,
    },
    credentials: {
      serviceScmCredentialId,
      setServiceScmCredentialId,
      serviceRegistryCredentialId,
      setServiceRegistryCredentialId,
      serviceSecretProviderId,
      setServiceSecretProviderId,
      scopedScmCredentials,
      scopedRegistryCredentials,
      secretProviders,
      credentialScopeLabel,
    },
    staticSite: {
      framework,
      setFramework,
      installCommand,
      setInstallCommand,
      buildCommand,
      setBuildCommand,
      outputDir,
      setOutputDir,
      cacheTtl,
      setCacheTtl,
    },
    scheduledJob: {
      enabled: isScheduledJob,
      scheduleCron,
      setScheduleCron,
      scheduleTimezone,
      setScheduleTimezone,
      scheduleCommand,
      setScheduleCommand,
      scheduleRetries,
      setScheduleRetries,
      scheduleTimeout,
      setScheduleTimeout,
    },
    settingsSaving,
    onSubmit: handleSettingsSave,
    onDiscard: handleDiscardSettings,
    isServiceActive,
    onToggleServiceActive: handleToggleServiceActive,
    onDeleteService: handleOpenDeleteService,
  };


  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <PageBackLink to={backLink} label={backLabel} />
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <ServiceTypeIcon type={service.type} size="lg" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground font-mono">{service.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{serviceTypeLabel}</span>
                    {service.type === 'microservice' && (
                      <Badge variant="outline" className="text-xs normal-case">
                        {deployStrategyLabel}
                      </Badge>
                    )}
                    {servicePublicURL.href ? (
                      <a
                        href={servicePublicURL.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {servicePublicURL.display}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : servicePublicURL.display ? (
                      <span className="text-sm text-muted-foreground">{servicePublicURL.display}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Runtime Information</h2>
          <p className="text-sm text-muted-foreground">
            Access telemetry, configuration, and operations in a unified view.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Viewing environment</p>
              <p className="text-xs text-muted-foreground">
                Controls the data shown in summary, metrics, logs, and deploy history.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Environment</Label>
              <Select value={viewEnv} onValueChange={(value) => setViewEnv(value as Environment)}>
                <SelectTrigger className="w-full sm:w-[200px] bg-card">
                  <SelectValue placeholder="Select env" />
                </SelectTrigger>
                <SelectContent>
                  {environmentOptions.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 flex w-full flex-wrap justify-start">
            <TabsTrigger value="summary" className="gap-2">
              <FileText className="w-4 h-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <Activity className="w-4 h-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Terminal className="w-4 h-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Rocket className="w-4 h-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

        <SummaryTab
          service={service}
          serviceTypeLabel={serviceTypeLabel}
          runtimeLabel={runtimeLabel}
          isServiceActive={isServiceActive}
          instanceLabel={instanceLabel}
          viewEnvLabel={viewEnvLabel}
          displayStatus={serviceDisplayStatus}
          latestDeployStrategySummary={deploysSorted[0]?.strategyStatus?.summary ?? undefined}
            repositoryUrl={repositoryUrl}
            dockerImageLabel={dockerImageLabel}
            branchName={branchName}
            dockerfileLabel={dockerfileLabel}
            dockerContextLabel={dockerContextLabel}
            envCountLabel={envCountLabel}
            healthPath={healthPath}
            appUrls={appUrls}
            deployBusy={deployBusy}
            deployDisabled={deployActionTemporarilyBlocked}
            deployRestrictionMessage={deployActionTemporarilyBlocked ? deployBlockedMessage : undefined}
            onDeployLatest={handleDeployLatest}
            onOpenVersionPicker={handleOpenVersionPicker}
            isCanaryStrategy={deployStrategyType === 'canary'}
            canaryPercent={Number(service.deploymentStrategy?.canaryPercent ?? canaryPercent) || 10}
            canPromoteCanary={
              deployStrategyType === 'canary' &&
              isSuccessfulDeployStatus(deploysSorted[0]?.status)
            }
            onPromoteCanary={handlePromoteCanary}
            promoteCanaryInProgress={promoteCanaryInProgress}
            cpuAvgLabel={cpuAvgLabel}
            cpuPeakLabel={cpuPeakLabel}
            memoryAvgLabel={memoryAvgLabel}
            memoryPeakLabel={memoryPeakLabel}
            latencyAvgLabel={latencyAvgLabel}
            latencyPeakLabel={latencyPeakLabel}
            requestsAvgLabel={requestsAvgLabel}
            requestsPeakLabel={requestsPeakLabel}
            isLive={isLiveSyncConnected || isFastPolling}
            liveSyncError={realtimeSyncError}
          />

          <MetricsTab
            metrics={metrics}
            replicaOptions={replicaOptions}
            metricsFrom={metricsFrom}
            metricsTo={metricsTo}
            metricsToNow={metricsToNow}
            variant={service.type === 'static-site' ? 'static-site' : 'microservice'}
            onTimeRangeChange={handleMetricsTimeRangeChange}
            onRefresh={handleMetricsRefresh}
          />

          <LogsTab
            selectedReplica={selectedReplica}
            onSelectReplica={handleReplicaChange}
            selectedContainer={selectedContainer}
            onSelectContainer={handleContainerChange}
            logsLoaded={logsLoaded}
            logsLoading={logsLoading}
            podsLoading={podsLoading}
            containersLoading={containersLoading}
            replicaOptions={replicaOptions}
            containerOptions={availableContainers}
            selectedContainerIsHistorical={selectedContainerIsHistorical}
            onLoadLogs={handleLoadLogs}
            visibleLogs={visibleLogs}
            viewEnvLabel={viewEnvLabel}
          />

          <EventsTab
            visibleEvents={visibleEvents}
            events={serviceEvents}
            deployEnvLabel={deployEnvLabel}
            pagination={eventsPagination}
            onOpenDeployLog={handleOpenDeployLog}
            onOpenRuleRuntimeLogs={handleOpenRuleRuntimeLogs}
            liveSyncError={realtimeSyncError}
            liveSyncLabel={lastRealtimeSyncLabel}
            liveSyncActive={isLiveSyncConnected || isFastPolling}
          />

          <RulesTab
            service={service}
            viewEnv={viewEnv}
            environmentRules={environmentRules}
            visibleServiceRules={visibleServiceRules}
            pagination={rulesPagination}
            onCreateRule={handleOpenCreateRule}
            onOpenEditRule={openEditRule}
            onOpenCopyRule={openCopyRule}
            onOpenPublishRule={openPublishRule}
            onDeleteRule={handleOpenDeleteRule}
          />

          <ServiceSettingsFormStoreProvider value={settingsFormStore}>
            <SettingsTab />
          </ServiceSettingsFormStoreProvider>
        </Tabs>
      </div>

      <ServiceDetailsDialogs
        deployVersion={{
          open: deployVersionOpen,
          setOpen: setDeployVersionOpen,
          viewEnvLabel,
          latestVersionLabel,
          deployVersion,
          setDeployVersion,
          versionOptions,
          onDeploySpecific: handleDeploySpecific,
        }}
        deployLog={{
          open: deployLogOpen,
          setOpen: setDeployLogOpen,
          selected: selectedDeployLog,
          setSelected: setSelectedDeployLog,
          deployEnvLabel,
        }}
        createRule={{
          open: createRuleOpen,
          setOpen: setCreateRuleOpen,
          onClose: resetNewRuleForm,
          viewEnv,
          newRuleName,
          setNewRuleName,
          newRuleAction,
          setNewRuleAction,
          newRuleMethods,
          toggleNewRuleMethod,
          newRulePathDraft,
          setNewRulePathDraft,
          addNewRulePath,
          newRulePaths,
          removeNewRulePath,
          newRulePublishTargets,
          setNewRulePublishTargets,
          onConfirm: handleCreateRule,
        }}
        editRule={{
          open: editRuleOpen,
          setOpen: setEditRuleOpen,
          onClose: resetEditRuleForm,
          viewEnv,
          editingRule,
          editRuleName,
          setEditRuleName,
          editRuleAction,
          setEditRuleAction,
          editRuleMethods,
          toggleEditRuleMethod,
          editRulePathDraft,
          setEditRulePathDraft,
          addEditRulePath,
          editRulePaths,
          removeEditRulePath,
          onOpenCopyFromEdit: handleOpenCopyFromEdit,
          onDeleteRuleFromEdit: handleDeleteRuleFromEdit,
          onConfirm: handleSaveRuleEdits,
        }}
        copyRule={{
          open: copyRuleOpen,
          setOpen: setCopyRuleOpen,
          onClose: resetCopyRuleForm,
          copyRule,
          viewEnv,
          environmentOptions,
          copyRuleEnvs,
          toggleCopyRuleEnvironment,
          onConfirm: handleCopyRuleConfirm,
        }}
        publishRule={{
          open: publishRuleOpen,
          setOpen: setPublishRuleOpen,
          onClose: () => setPublishRuleId(null),
          publishRule,
          viewEnv,
          publishTargets,
          setPublishTargets,
          onConfirm: handleConfirmPublishRule,
        }}
        deleteRule={{
          open: deleteRuleOpen,
          onOpenChange: handleDeleteRuleOpenChange,
          selected: selectedRule,
          onConfirm: handleDeleteRuleConfirm,
        }}
        deleteService={{
          open: deleteOpen,
          setOpen: setDeleteOpen,
          service,
          onConfirm: handleDeleteService,
        }}
        confirmDeploy={{
          open: confirmDeployOpen,
          setOpen: setConfirmDeployOpen,
          service,
          viewEnv,
          pendingVersion: pendingDeployVersion,
          onStart: handleDeploySubmitStart,
          onError: handleDeploySubmitError,
          onConfirm: handleConfirmDeploy,
        }}
      />

      <ConfirmPromoteCanaryModal
        open={promoteCanaryOpen}
        onOpenChange={setPromoteCanaryOpen}
        serviceName={service?.name ?? ''}
        environment={viewEnv}
        canaryPercent={Number(service?.deploymentStrategy?.canaryPercent ?? canaryPercent) || 10}
        onConfirm={handleConfirmPromoteCanary}
      />

    </AppLayout>
  );
};

export default ServiceDetails;
