import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cpu,
  KeyRound,
  Layers,
  Plus,
  Zap,
  MoreVertical,
  Settings2,
  RefreshCw,
  Trash2,
  CheckCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { QuickStatsGrid } from '@/components/layout/QuickStatsGrid';
import { TableFiltersBar } from '@/components/layout/TableFiltersBar';
import { TablePagination } from '@/components/layout/TablePagination';
import { EmptyState, TableEmptyRow } from '@/components/layout/EmptyState';
import { ConfirmActionModal } from '@/components/modals/ConfirmActionModal';
import { toast } from '@/hooks/use-toast';
import { useTablePagination } from '@/hooks/use-table-pagination';
import { Environment, Worker, WorkerBootstrapProfile, WorkerPool, WorkerRegistration, WorkerStatus } from '@/types/releasea';
import { environmentsShareNamespace, getEnvironmentConfigs, getEnvironmentLabel } from '@/lib/environments';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  createWorkerRegistration,
  deleteWorker,
  deleteWorkerRegistration,
  fetchWorkerBootstrapProfile,
  fetchWorkerPools,
  fetchWorkerRegistrations,
  fetchWorkers,
  setWorkerPoolDrain,
  restartWorker,
  setWorkerPoolMaintenance,
  updateWorker,
} from '@/lib/data';
import { getDocsUrl } from '@/lib/docs-url';

const defaultPlatformNamespace = import.meta.env.RELEASEA_PLATFORM_NAMESPACE?.trim() || 'releasea-system';
const defaultWorkerNamespacePrefix = 'releasea-apps';
const defaultWorkerAPIBaseUrl = import.meta.env.RELEASEA_WORKER_API_BASE_URL?.trim()
  || `http://releasea-api.${defaultPlatformNamespace}.svc.cluster.local:8070/api/v1`;

const fallbackBootstrapProfile: WorkerBootstrapProfile = {
  id: 'worker-bootstrap-profile',
  mode: 'same-cluster',
  version: '1',
  platformNamespace: defaultPlatformNamespace,
  apiBaseUrl: defaultWorkerAPIBaseUrl,
  rabbitmqUrl: `amqp://releasea:releasea@releasea-rabbitmq.${defaultPlatformNamespace}.svc.cluster.local:5672/`,
  internalDomain: 'releasea.internal',
  externalDomain: 'releasea.external',
  internalGateway: 'istio-system/releasea-internal-gateway',
  externalGateway: 'istio-system/releasea-external-gateway',
  namespacePrefix: defaultWorkerNamespacePrefix,
  minioEndpoint: `releasea-minio.${defaultPlatformNamespace}.svc.cluster.local:9000`,
  minioBucket: 'releasea-static',
  minioSecure: false,
  staticNginxService: 'releasea-static-nginx',
  staticNginxNamespace: defaultPlatformNamespace,
  source: {
    configMap: 'releasea-worker-bootstrap',
    secret: 'releasea-worker-bootstrap',
  },
};

const normalizeBootstrapProfile = (profile: WorkerBootstrapProfile | null | undefined): WorkerBootstrapProfile => ({
  ...fallbackBootstrapProfile,
  ...profile,
  source: {
    ...fallbackBootstrapProfile.source,
    ...(profile?.source ?? {}),
  },
});

const escapeHelmSetValue = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/=/g, '\\=');

const buildInstallCommand = (
  registration: WorkerRegistration,
) => {
  const tags = registration.tags.length > 0 ? registration.tags.join(',') : registration.environment;
  const registrationToken = registration.token?.trim() || '<generate-token-first>';

  const flags = [
    `--set token=${escapeHelmSetValue(registrationToken)}`,
    `--set environment=${escapeHelmSetValue(registration.environment)}`,
    `--set tags='${escapeHelmSetValue(tags)}'`,
    `--set worker.name=${escapeHelmSetValue(registration.name)}`,
  ];

  const flagLines = flags.map((flag, index) => `  ${flag}${index < flags.length - 1 ? ' \\' : ''}`);
  return [
    'helm repo add releasea https://releasea.github.io/releasea-charts',
    'helm repo update releasea',
    'helm upgrade --install releasea-worker releasea/releasea-worker \\',
    ...flagLines,
  ].join('\n');
};

const createTokenValue = () =>
  `frg_reg_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 6)}`;

const getStatusColor = (status: WorkerStatus) => {
  switch (status) {
    case 'online': return 'bg-success';
    case 'busy': return 'bg-warning';
    case 'pending': return 'bg-info';
    case 'offline': return 'bg-destructive';
    default: return 'bg-muted';
  }
};

const getStatusPulseColor = (status: WorkerStatus) => {
  switch (status) {
    case 'online': return 'bg-success/40';
    case 'offline': return 'bg-destructive/40';
    default: return 'bg-muted/30';
  }
};

const shouldPulseStatus = (status: WorkerStatus) => status === 'online' || status === 'offline';

const formatHeartbeat = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }
  return format(date, 'MMM dd, HH:mm');
};

const toWorkerStatus = (status: WorkerRegistration['status']): WorkerStatus => {
  if (status === 'unused' || status === 'active') return 'pending';
  return 'offline';
};

const registrationStatusLabel = (status: WorkerRegistration['status']) => {
  if (status === 'unused') return 'Registration pending';
  if (status === 'active') return 'Registration active';
  if (status === 'inactive') return 'Registration inactive';
  return 'Registration revoked';
};

type WorkerListItem =
  | {
      kind: 'worker';
      id: string;
      status: WorkerStatus;
      worker: Worker;
      registration?: WorkerRegistration;
    }
  | {
      kind: 'registration';
      id: string;
      status: WorkerStatus;
      registration: WorkerRegistration;
    };

type WorkerPoolPreview = WorkerPool & {
  compatible: boolean;
  fallbackRank: number | null;
};

const poolStatusLabel = (status: WorkerStatus) => {
  if (status === 'busy') return 'Busy';
  if (status === 'online') return 'Healthy';
  if (status === 'pending') return 'Pending';
  return 'Offline';
};

const poolCapacityLabel = (state: WorkerPool['capacityState']) => {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'constrained':
      return 'Constrained';
    case 'maintenance':
      return 'Maintenance';
    case 'draining':
      return 'Draining';
    case 'bootstrap':
      return 'Bootstrap';
    case 'degraded':
      return 'Degraded';
    default:
      return 'Unavailable';
  }
};

const poolSaturationLabel = (state: WorkerPool['saturationState']) => {
  switch (state) {
    case 'saturated':
      return 'Saturated';
    case 'hot':
      return 'Hot';
    case 'active':
      return 'Active';
    case 'draining':
      return 'Draining';
    case 'maintenance':
      return 'Maintenance';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Idle';
  }
};

const poolSaturationBarClass = (state: WorkerPool['saturationState']) => {
  switch (state) {
    case 'saturated':
      return 'bg-destructive';
    case 'hot':
      return 'bg-warning';
    case 'active':
      return 'bg-info';
    case 'draining':
      return 'bg-warning/80';
    case 'maintenance':
      return 'bg-destructive/80';
    case 'unavailable':
      return 'bg-muted';
    default:
      return 'bg-success';
  }
};

const normalizePoolTagInput = (value: string | string[] | undefined | null) => {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  const normalized: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || normalized.includes(trimmed)) continue;
    normalized.push(trimmed);
  }
  return normalized;
};

const poolSupportsFallback = (pool: WorkerPool, environment: Environment | 'all', requiredTags: string[]) => {
  if (pool.maintenanceEnabled || pool.drainEnabled) return false;
  const matchesEnvironment =
    environment === 'all' || environmentsShareNamespace(pool.environment, environment);
  if (!matchesEnvironment) return false;
  if (requiredTags.length === 0) return true;
  const availableTags = new Set(pool.tags.map((tag) => tag.trim()).filter(Boolean));
  return requiredTags.every((tag) => availableTags.has(tag));
};

const poolFallbackSortValue = (pool: WorkerPool, requiredTags: string[]) => {
  const availableTags = new Set(pool.tags.map((tag) => tag.trim()).filter(Boolean));
  const extraTags = pool.tags.filter((tag) => !requiredTags.includes(tag)).length;
  const lastHeartbeat = Date.parse(pool.lastHeartbeat ?? '');
  return {
    extraTags,
    onlineAgents: pool.onlineAgents,
    onlineWorkers: pool.onlineWorkers + pool.busyWorkers,
    lastHeartbeat: Number.isNaN(lastHeartbeat) ? 0 : lastHeartbeat,
  };
};

const workerBelongsToPool = (
  worker: Pick<Worker, 'environment' | 'cluster' | 'namespacePrefix' | 'tags'>,
  pool: WorkerPool,
) => {
  if (worker.environment !== pool.environment) return false;
  if ((worker.cluster ?? '') !== (pool.cluster ?? '')) return false;
  if ((worker.namespacePrefix ?? '') !== (pool.namespacePrefix ?? '')) return false;
  const workerTags = normalizePoolTagInput(worker.tags);
  const poolTags = normalizePoolTagInput(pool.tags);
  return workerTags.length === poolTags.length && workerTags.every((tag, index) => tag === poolTags[index]);
};

const Workers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [registrations, setRegistrations] = useState<WorkerRegistration[]>([]);
  const workerStatusRef = useRef<Map<string, WorkerStatus>>(new Map());
  const [activeRegistration, setActiveRegistration] = useState<WorkerRegistration | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  const [registrationEnvironment, setRegistrationEnvironment] = useState<Environment>('dev');
  const [registrationTags, setRegistrationTags] = useState('dev, build');
  const [registrationCluster, setRegistrationCluster] = useState('dev-aks-01');
  const [registrationNamespacePrefix, setRegistrationNamespacePrefix] = useState(defaultWorkerNamespacePrefix);
  const [registrationNotes, setRegistrationNotes] = useState('');
  const [configureOpen, setConfigureOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRegistrationOpen, setDeleteRegistrationOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<WorkerRegistration | null>(null);
  const [configName, setConfigName] = useState('');
  const [configEnvironment, setConfigEnvironment] = useState<Environment>('dev');
  const [configTags, setConfigTags] = useState('');
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState<Environment | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | 'all'>('all');
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  const [poolEnvironmentFilter, setPoolEnvironmentFilter] = useState<Environment | 'all'>('all');
  const [poolStatusFilter, setPoolStatusFilter] = useState<WorkerStatus | 'all'>('all');
  const [poolRequiredTags, setPoolRequiredTags] = useState('');
  const [selectedPool, setSelectedPool] = useState<WorkerPoolPreview | null>(null);
  const [poolDetailsOpen, setPoolDetailsOpen] = useState(false);
  const [poolMaintenanceReason, setPoolMaintenanceReason] = useState('');
  const [isPoolMaintenanceSaving, setIsPoolMaintenanceSaving] = useState(false);
  const [poolDrainReason, setPoolDrainReason] = useState('');
  const [isPoolDrainSaving, setIsPoolDrainSaving] = useState(false);
  const [bootstrapProfile, setBootstrapProfile] = useState<WorkerBootstrapProfile>(fallbackBootstrapProfile);
  const effectiveBootstrapProfile = normalizeBootstrapProfile(bootstrapProfile);

  useEffect(() => {
    if (searchParams.get('action') !== 'register') return;
    setRegisterOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setRegistrationNamespacePrefix((current) => {
      if (current.trim() !== '' && current !== defaultWorkerNamespacePrefix) {
        return current;
      }
      return effectiveBootstrapProfile.namespacePrefix || defaultWorkerNamespacePrefix;
    });
  }, [effectiveBootstrapProfile.namespacePrefix]);

  const environmentOptions = getEnvironmentConfigs();
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [workersData, workerPoolsData, registrationsData, profileData] = await Promise.all([
        fetchWorkers(),
        fetchWorkerPools(),
        fetchWorkerRegistrations(),
        fetchWorkerBootstrapProfile(),
      ]);
      if (!active) return;
      const previousStatuses = workerStatusRef.current;
      const newlyOffline: Worker[] = [];
      const nextStatuses = new Map<string, WorkerStatus>();
      workersData.forEach((worker) => {
        const prevStatus = previousStatuses.get(worker.id);
        if (prevStatus && prevStatus !== 'offline' && worker.status === 'offline') {
          newlyOffline.push(worker);
        }
        nextStatuses.set(worker.id, worker.status);
      });
      workerStatusRef.current = nextStatuses;
      setWorkers(workersData);
      setWorkerPools(workerPoolsData);
      setRegistrations(registrationsData);
      setBootstrapProfile(normalizeBootstrapProfile(profileData));
      if (newlyOffline.length === 1) {
        toast({
          title: 'Worker offline',
          description: `${newlyOffline[0].name} is no longer responding.`,
        });
      } else if (newlyOffline.length > 1) {
        toast({
          title: 'Workers offline',
          description: `${newlyOffline.length} workers are no longer responding.`,
        });
      }
    };
    load();
    const interval = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerPools, setWorkerPools] = useState<WorkerPool[]>([]);
  const onlineWorkers = workers.filter((w) => w.status === 'online' || w.status === 'busy').length;
  const totalWorkers = workers.length;

  const registrationsByID = new Map(registrations.map((registration) => [registration.id, registration]));
  const seenRegistrationIDs = new Set<string>();
  const workerRows: WorkerListItem[] = workers.map((worker) => {
    const registration =
      (worker.credentialId ? registrationsByID.get(worker.credentialId) : undefined)
      ?? (worker.credentialIds ?? []).map((id) => registrationsByID.get(id)).find(Boolean);
    if (registration) {
      seenRegistrationIDs.add(registration.id);
    }
    return {
      kind: 'worker',
      id: worker.id,
      status: worker.status,
      worker,
      registration: registration ?? undefined,
    };
  });

  const registrationRows: WorkerListItem[] = registrations
    .filter((registration) => !seenRegistrationIDs.has(registration.id))
    .map((registration) => ({
      kind: 'registration',
      id: `registration:${registration.id}`,
      status: toWorkerStatus(registration.status),
      registration,
    }));

  const workerListRows = [...workerRows, ...registrationRows];

  const filteredWorkers = workerListRows.filter((row) => {
    const query = searchQuery.trim().toLowerCase();
    const worker = row.kind === 'worker' ? row.worker : undefined;
    const registration = row.registration;
    const matchesSearch = !query
      || [
        worker?.name ?? registration?.name ?? '',
        worker?.cluster ?? registration?.cluster ?? '',
        worker?.namespace ?? registration?.namespace ?? '',
        worker?.namespacePrefix ?? registration?.namespacePrefix ?? '',
        worker?.environment ?? registration?.environment ?? '',
        ...(worker?.tags ?? registration?.tags ?? []),
      ].join(' ').toLowerCase().includes(query);
    const matchesEnv = environmentFilter === 'all'
      || (worker?.environment ?? registration?.environment) === environmentFilter;
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
    return matchesSearch && matchesEnv && matchesStatus;
  });
  const workersPagination = useTablePagination(filteredWorkers.length);
  const visibleWorkers = workersPagination.slice(filteredWorkers);

  const agentTotals = workers.reduce(
    (acc, w) => ({ online: acc.online + w.onlineAgents, desired: acc.desired + w.desiredAgents }),
    { online: 0, desired: 0 }
  );

  const pendingRegistrations = registrations.filter((r) => r.status === 'unused').length;
  const activePools = workerPools.filter((pool) => pool.status === 'online' || pool.status === 'busy').length;
  const workerDocsUrl = getDocsUrl('environments-and-workers');
  const requiredPoolTags = useMemo(() => normalizePoolTagInput(poolRequiredTags), [poolRequiredTags]);
  const filteredPools = useMemo(() => {
    const query = poolSearchQuery.trim().toLowerCase();
    const basePools = workerPools.filter((pool) => {
      const matchesSearch =
        !query ||
        [
          pool.cluster,
          pool.namespacePrefix,
          pool.environment,
          ...pool.tags,
          ...pool.namespaces,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      const matchesEnv =
        poolEnvironmentFilter === 'all' || environmentsShareNamespace(pool.environment, poolEnvironmentFilter);
      const matchesStatus = poolStatusFilter === 'all' || pool.status === poolStatusFilter;
      return matchesSearch && matchesEnv && matchesStatus;
    });

    const compatiblePools = basePools
      .filter((pool) => poolSupportsFallback(pool, poolEnvironmentFilter, requiredPoolTags))
      .sort((left, right) => {
        const leftRank = poolFallbackSortValue(left, requiredPoolTags);
        const rightRank = poolFallbackSortValue(right, requiredPoolTags);
        if (leftRank.extraTags !== rightRank.extraTags) return leftRank.extraTags - rightRank.extraTags;
        if (left.capacityScore !== right.capacityScore) return right.capacityScore - left.capacityScore;
        if (leftRank.onlineAgents !== rightRank.onlineAgents) return rightRank.onlineAgents - leftRank.onlineAgents;
        if (leftRank.onlineWorkers !== rightRank.onlineWorkers) return rightRank.onlineWorkers - leftRank.onlineWorkers;
        if (leftRank.lastHeartbeat !== rightRank.lastHeartbeat) return rightRank.lastHeartbeat - leftRank.lastHeartbeat;
        return left.id.localeCompare(right.id);
      });

    const fallbackRank = new Map<string, number>();
    compatiblePools.forEach((pool, index) => fallbackRank.set(pool.id, index + 1));

    return basePools
      .map((pool) => ({
        ...pool,
        compatible: poolSupportsFallback(pool, poolEnvironmentFilter, requiredPoolTags),
        fallbackRank: fallbackRank.get(pool.id) ?? null,
      }))
      .sort((left, right) => {
        if (left.compatible !== right.compatible) return left.compatible ? -1 : 1;
        if ((left.fallbackRank ?? Number.MAX_SAFE_INTEGER) !== (right.fallbackRank ?? Number.MAX_SAFE_INTEGER)) {
          return (left.fallbackRank ?? Number.MAX_SAFE_INTEGER) - (right.fallbackRank ?? Number.MAX_SAFE_INTEGER);
        }
        return left.id.localeCompare(right.id);
      });
  }, [poolEnvironmentFilter, poolSearchQuery, poolStatusFilter, requiredPoolTags, workerPools]);
  const selectedPoolWorkers = useMemo(
    () => (selectedPool ? workers.filter((worker) => workerBelongsToPool(worker, selectedPool)) : []),
    [selectedPool, workers],
  );
  const selectedPoolRegistrations = useMemo(
    () => (selectedPool ? registrations.filter((registration) => workerBelongsToPool(registration, selectedPool)) : []),
    [registrations, selectedPool],
  );
  useEffect(() => {
    setPoolMaintenanceReason(selectedPool?.maintenanceReason ?? '');
  }, [selectedPool]);
  useEffect(() => {
    setPoolDrainReason(selectedPool?.drainReason ?? '');
  }, [selectedPool]);

  const getWorkerActionId = (worker: Worker) => worker.primaryId ?? worker.id;

  const handleConfigureWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setConfigName(worker.name);
    setConfigEnvironment(worker.environment);
    setConfigTags(worker.tags.join(', '));
    setConfigureOpen(true);
  };

  const handleSaveConfiguration = async () => {
    if (!selectedWorker) return;
    const actionId = getWorkerActionId(selectedWorker);
    const parsedTags = configTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    await updateWorker(actionId, {
      name: configName.trim() || selectedWorker.name,
      environment: selectedWorker.environment,
      tags: parsedTags.length > 0 ? parsedTags : selectedWorker.tags,
    });
    const nextPools = await fetchWorkerPools();

    setWorkers((prev) =>
      prev.map((worker) =>
        worker.id === selectedWorker.id
          ? {
              ...worker,
              name: configName.trim() || worker.name,
              environment: selectedWorker.environment,
              tags: parsedTags.length > 0 ? parsedTags : worker.tags,
            }
          : worker
      )
    );
    setWorkerPools(nextPools);
    setConfigureOpen(false);
    toast({
      title: 'Worker updated',
      description: 'Worker configuration saved.',
    });
  };

  const handleRestartWorker = async () => {
    if (!selectedWorker) return;
    const actionId = getWorkerActionId(selectedWorker);
    await restartWorker(actionId);
    toast({
      title: 'Restart requested',
      description: `Restart signal sent to "${selectedWorker.name}".`,
    });
  };

  const issueRegistrationToken = async (
    seed: Pick<WorkerRegistration, 'name' | 'environment' | 'tags' | 'cluster' | 'namespacePrefix' | 'namespace' | 'notes'>,
    successTitle: string,
    successDescription: string,
  ) => {
    if (isRegeneratingToken) return;
    setIsRegeneratingToken(true);
    try {
      const now = new Date();
      const nextRegistration: WorkerRegistration = {
        id: `wkr-reg-${now.getTime()}`,
        name: seed.name,
        environment: seed.environment,
        tags: seed.tags.length > 0 ? seed.tags : [seed.environment],
        cluster: seed.cluster || 'kubernetes-cluster',
        namespacePrefix: seed.namespacePrefix?.trim() || effectiveBootstrapProfile.namespacePrefix || defaultWorkerNamespacePrefix,
        namespace: seed.namespace?.trim() || effectiveBootstrapProfile.platformNamespace,
        createdAt: now.toISOString(),
        token: createTokenValue(),
        status: 'unused',
        notes: seed.notes,
      };

      const savedRegistration = await createWorkerRegistration(nextRegistration);
      const nextPools = await fetchWorkerPools();
      setRegistrations((prev) => [savedRegistration, ...prev]);
      setWorkerPools(nextPools);
      setActiveRegistration(savedRegistration);
      setInstallOpen(true);
      toast({
        title: successTitle,
        description: successDescription,
      });
    } finally {
      setIsRegeneratingToken(false);
    }
  };

  const handleRegistrationTokenFromRow = async (registration: WorkerRegistration) => {
    await issueRegistrationToken(
      {
        name: registration.name,
        environment: registration.environment,
        tags: registration.tags,
        cluster: registration.cluster,
        namespacePrefix: registration.namespacePrefix,
        namespace: registration.namespace,
        notes: registration.notes || 'Reissued from worker registrations.',
      },
      'Token generated',
      `A new installation token is ready for "${registration.name}".`,
    );
  };

  const handleRegenerateToken = async () => {
    if (!selectedWorker) return;
    await issueRegistrationToken(
      {
        name: selectedWorker.name,
        environment: selectedWorker.environment,
        tags: selectedWorker.tags,
        cluster: selectedWorker.cluster,
        namespacePrefix: selectedWorker.namespacePrefix,
        namespace: selectedWorker.namespace,
        notes: 'Regenerated from worker settings.',
      },
      'Token regenerated',
      `A new registration token is ready for "${selectedWorker.name}".`,
    );
    setConfigureOpen(false);
  };

  const handleDeleteWorker = async () => {
    if (!selectedWorker) return;
    const actionId = getWorkerActionId(selectedWorker);
    await deleteWorker(actionId);
    const [nextWorkers, nextPools, nextRegistrations] = await Promise.all([
      fetchWorkers(),
      fetchWorkerPools(),
      fetchWorkerRegistrations(),
    ]);
    setWorkers(nextWorkers);
    setWorkerPools(nextPools);
    setRegistrations(nextRegistrations);
    toast({
      title: 'Worker deleted',
      description: `Worker "${selectedWorker.name}" removed and token revoked.`,
    });
  };

  const handleDeleteRegistration = async () => {
    if (!selectedRegistration) return;
    await deleteWorkerRegistration(selectedRegistration.id);
    const nextPools = await fetchWorkerPools();
    setRegistrations((prev) => prev.filter((registration) => registration.id !== selectedRegistration.id));
    setWorkerPools(nextPools);
    setDeleteRegistrationOpen(false);
    toast({
      title: 'Registration deleted',
      description: `Registration "${selectedRegistration.name}" removed and token revoked.`,
    });
  };

  const refreshWorkerPools = async () => {
    const nextPools = await fetchWorkerPools();
    const compatiblePools = nextPools
      .filter((pool) => poolSupportsFallback(pool, poolEnvironmentFilter, requiredPoolTags))
      .sort((left, right) => {
        const leftRank = poolFallbackSortValue(left, requiredPoolTags);
        const rightRank = poolFallbackSortValue(right, requiredPoolTags);
        if (leftRank.extraTags !== rightRank.extraTags) return leftRank.extraTags - rightRank.extraTags;
        if (left.capacityScore !== right.capacityScore) return right.capacityScore - left.capacityScore;
        if (leftRank.onlineAgents !== rightRank.onlineAgents) return rightRank.onlineAgents - leftRank.onlineAgents;
        if (leftRank.onlineWorkers !== rightRank.onlineWorkers) return rightRank.onlineWorkers - leftRank.onlineWorkers;
        if (leftRank.lastHeartbeat !== rightRank.lastHeartbeat) return rightRank.lastHeartbeat - leftRank.lastHeartbeat;
        return left.id.localeCompare(right.id);
      });
    const fallbackRank = new Map<string, number>();
    compatiblePools.forEach((pool, index) => fallbackRank.set(pool.id, index + 1));

    setWorkerPools(nextPools);
    setSelectedPool((current) => {
      if (!current) return null;
      const nextSelected = nextPools.find((pool) => pool.id === current.id);
      return nextSelected ? {
        ...nextSelected,
        compatible: poolSupportsFallback(nextSelected, poolEnvironmentFilter, requiredPoolTags),
        fallbackRank: fallbackRank.get(nextSelected.id) ?? null,
      } : null;
    });
    return nextPools;
  };

  const handleSetPoolMaintenance = async (pool: WorkerPoolPreview, enabled: boolean) => {
    if (enabled && !poolMaintenanceReason.trim()) {
      toast({
        title: 'Maintenance reason required',
        description: 'Describe why this pool is being removed from routing before enabling maintenance mode.',
        variant: 'destructive',
      });
      return;
    }

    setIsPoolMaintenanceSaving(true);
    try {
      const ok = await setWorkerPoolMaintenance(pool.id, {
        enabled,
        reason: enabled ? poolMaintenanceReason.trim() : '',
      });
      if (!ok) {
        throw new Error('Unable to update worker pool maintenance mode.');
      }
      await refreshWorkerPools();
      toast({
        title: enabled ? 'Pool maintenance enabled' : 'Pool maintenance disabled',
        description: enabled
          ? 'This pool is now excluded from routing and fallback selection.'
          : 'This pool is eligible for routing again.',
      });
    } catch (error) {
      toast({
        title: 'Failed to update pool maintenance',
        description: error instanceof Error ? error.message : 'Try again in a few moments.',
        variant: 'destructive',
      });
    } finally {
      setIsPoolMaintenanceSaving(false);
    }
  };

  const handleSetPoolDrain = async (pool: WorkerPoolPreview, enabled: boolean) => {
    if (enabled && !poolDrainReason.trim()) {
      toast({
        title: 'Drain reason required',
        description: 'Describe why this pool should stop accepting new work before enabling drain mode.',
        variant: 'destructive',
      });
      return;
    }

    setIsPoolDrainSaving(true);
    try {
      const ok = await setWorkerPoolDrain(pool.id, {
        enabled,
        reason: enabled ? poolDrainReason.trim() : '',
      });
      if (!ok) {
        throw new Error('Unable to update worker pool drain mode.');
      }
      await refreshWorkerPools();
      toast({
        title: enabled ? 'Pool drain enabled' : 'Pool drain disabled',
        description: enabled
          ? 'New operations will no longer be claimed from this pool until drain mode is disabled.'
          : 'This pool can claim new operations again.',
      });
    } catch (error) {
      toast({
        title: 'Failed to update pool drain',
        description: error instanceof Error ? error.message : 'Try again in a few moments.',
        variant: 'destructive',
      });
    } finally {
      setIsPoolDrainSaving(false);
    }
  };

  const handleCreateRegistration = async () => {
    const parsedTags = registrationTags.split(',').map((t) => t.trim()).filter(Boolean);
    const registrationWorkerName =
      registrationName.trim() || `${registrationEnvironment}-runner-${Date.now().toString().slice(-4)}`;
    await issueRegistrationToken(
      {
        name: registrationWorkerName,
        environment: registrationEnvironment,
        tags: parsedTags,
        cluster: registrationCluster.trim() || 'kubernetes-cluster',
        namespacePrefix: registrationNamespacePrefix.trim() || effectiveBootstrapProfile.namespacePrefix || defaultWorkerNamespacePrefix,
        namespace: effectiveBootstrapProfile.platformNamespace,
        notes: registrationNotes.trim() || undefined,
      },
      'Registration token created',
      `Worker "${registrationWorkerName}" is ready to be installed.`,
    );
    setRegisterOpen(false);

    // Reset form
    setRegistrationName('');
    setRegistrationTags('');
    setRegistrationNotes('');
  };

  const stats = [
    { 
      label: 'Workers Online', 
      value: `${onlineWorkers}/${totalWorkers}`,
      icon: <Cpu className="w-4 h-4 text-success" />,
    },
    { 
      label: 'Agents Active', 
      value: `${agentTotals.online}/${agentTotals.desired}`,
      icon: <Zap className="w-4 h-4 text-warning" />,
    },
    { 
      label: 'Worker Pools', 
      value: workerPools.length.toString(),
      sublabel: `${activePools} active`,
      icon: <Layers className="w-4 h-4 text-info" />,
    },
    { 
      label: 'Pending Tokens', 
      value: pendingRegistrations.toString(),
      icon: <KeyRound className="w-4 h-4 text-primary" />,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <ListPageHeader
          title="Workers"
          description="Manage Kubernetes runners and agent capacity across environments"
          actions={
            <Button onClick={() => setRegisterOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Register Worker
            </Button>
          }
        />

        <QuickStatsGrid stats={stats} />

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Worker Pools</h2>
              <p className="text-xs text-muted-foreground">
                Aggregated capacity by environment, cluster, namespace prefix, and tag set.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {workerPools.length > 0
                ? `${workerPools.length} pools discovered`
                : 'Pools appear after a worker registration or heartbeat is recorded.'}
            </p>
          </div>

          {workerPools.length > 0 ? (
            <>
              <TableFiltersBar
                search={{
                  value: poolSearchQuery,
                  onChange: setPoolSearchQuery,
                  placeholder: 'Search pools...',
                }}
                selects={[
                  {
                    id: 'pool-environment',
                    value: poolEnvironmentFilter,
                    onValueChange: (value) => setPoolEnvironmentFilter(value as Environment | 'all'),
                    icon: <Layers className="h-4 w-4 text-muted-foreground" />,
                    options: [
                      { value: 'all', label: 'All pool environments' },
                      ...environmentOptions.map((opt) => ({ value: opt.id, label: opt.name })),
                    ],
                  },
                  {
                    id: 'pool-status',
                    value: poolStatusFilter,
                    onValueChange: (value) => setPoolStatusFilter(value as WorkerStatus | 'all'),
                    icon: <Zap className="h-4 w-4 text-muted-foreground" />,
                    options: [
                      { value: 'all', label: 'All pool statuses' },
                      { value: 'online', label: 'Healthy' },
                      { value: 'busy', label: 'Busy' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'offline', label: 'Offline' },
                    ],
                  },
                ]}
              />
              <div className="space-y-2">
                <Label htmlFor="pool-required-tags">Required tags for routing preview</Label>
                <Input
                  id="pool-required-tags"
                  value={poolRequiredTags}
                  onChange={(event) => setPoolRequiredTags(event.target.value)}
                  placeholder="e.g., build, gpu"
                  className="bg-muted/50 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Operations can run in any pool whose workers carry all required tags. Compatible pools are ordered by
                  exact tag match first, then by live capacity and heartbeat freshness.
                </p>
              </div>
            </>
          ) : null}

          {workerPools.length > 0 && filteredPools.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredPools.map((pool) => (
                <button
                  key={pool.id}
                  type="button"
                  onClick={() => {
                    setSelectedPool(pool);
                    setPoolDetailsOpen(true);
                  }}
                  className="rounded-lg border border-border bg-card p-4 space-y-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pool.cluster || 'unassigned-cluster'}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {pool.namespacePrefix || 'no-namespace-prefix'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getEnvironmentLabel(pool.environment)}
                      </Badge>
                      {pool.maintenanceEnabled ? (
                        <Badge variant="destructive" className="text-xs">
                          Maintenance
                        </Badge>
                      ) : null}
                      {pool.drainEnabled ? (
                        <Badge variant="outline" className="text-xs border-warning/60 text-warning">
                          Draining
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="text-xs">
                        {poolCapacityLabel(pool.capacityState)} · {pool.capacityScore}
                      </Badge>
                      {(requiredPoolTags.length > 0 || poolEnvironmentFilter !== 'all') && (
                        pool.compatible ? (
                          <Badge variant="secondary" className="text-xs">
                            Fallback #{pool.fallbackRank}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Incompatible
                          </Badge>
                        )
                      )}
                      <StatusBadge status={pool.status} className="normal-case" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {pool.tags.length > 0 ? (
                      pool.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs normal-case px-2 py-0.5">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        No tags
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workers</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pool.onlineWorkers + pool.busyWorkers}/{pool.workerCount}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agents</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pool.availableAgents}/{pool.onlineAgents}/{pool.desiredAgents}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pool.pendingRegistrations}/{pool.registrationCount}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span>Saturation</span>
                      <span className="normal-case tracking-normal text-foreground">
                        {poolSaturationLabel(pool.saturationState)} · {pool.saturationPercent}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${poolSaturationBarClass(pool.saturationState)}`}
                        style={{ width: `${pool.saturationPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      {pool.maintenanceEnabled
                        ? 'Maintenance mode'
                        : pool.drainEnabled
                          ? 'Drain mode'
                          : `${poolStatusLabel(pool.status)} pool`}
                    </span>
                    <span>{pool.lastHeartbeat ? `Last online ${formatHeartbeat(pool.lastHeartbeat)}` : 'No heartbeat yet'}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {pool.namespaces.length > 0 ? (
                      <span>
                        Namespaces: <span className="font-mono">{pool.namespaces.join(', ')}</span>
                      </span>
                    ) : (
                      'No namespaces discovered yet'
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : workerPools.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/60 p-10">
              <EmptyState
                icon={<Layers className="h-5 w-5 text-muted-foreground" />}
                title="No worker pools discovered yet"
                description="Register a worker or wait for the first heartbeat to establish pool inventory and capacity scoring."
                actionLabel="Register worker"
                onAction={() => setRegisterOpen(true)}
                tone="muted"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/60 p-10">
              <EmptyState
                icon={<Layers className="h-5 w-5 text-muted-foreground" />}
                title="No pools match the current filters"
                description="Adjust the environment, status, or tag filters to find another compatible worker pool."
                tone="muted"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <TableFiltersBar
            search={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: 'Search workers...',
            }}
            selects={[
              {
                id: 'environment',
                value: environmentFilter,
                onValueChange: (value) => setEnvironmentFilter(value as Environment | 'all'),
                icon: <Layers className="h-4 w-4 text-muted-foreground" />,
                options: [
                  { value: 'all', label: 'All environments' },
                  ...environmentOptions.map((opt) => ({ value: opt.id, label: opt.name })),
                ],
              },
              {
                id: 'status',
                value: statusFilter,
                onValueChange: (value) => setStatusFilter(value as WorkerStatus | 'all'),
                icon: <Zap className="h-4 w-4 text-muted-foreground" />,
                options: [
                  { value: 'all', label: 'All statuses' },
                  { value: 'online', label: 'Online' },
                  { value: 'busy', label: 'Busy' },
                  { value: 'pending', label: 'Waiting' },
                  { value: 'offline', label: 'Offline' },
                ],
              },
            ]}
          />

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Worker
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Environment
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                      Tags
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                      Agents
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                      Last online
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkers.map((row) => {
                    const worker = row.kind === 'worker' ? row.worker : null;
                    const registration = row.registration;
                    const displayStatus = row.status;
                    const tags = worker?.tags ?? registration?.tags ?? [];
                    const name = worker?.name ?? registration?.name ?? 'worker-registration';
                    const cluster = worker?.cluster ?? registration?.cluster ?? 'kubernetes-cluster';
                    const namespace = worker?.namespace ?? registration?.namespace ?? effectiveBootstrapProfile.platformNamespace;
                    const environment = worker?.environment ?? registration?.environment ?? 'dev';

                    return (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="relative flex h-2.5 w-2.5">
                              {shouldPulseStatus(displayStatus) && (
                                <span
                                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${getStatusPulseColor(displayStatus)}`}
                                />
                              )}
                              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${getStatusColor(displayStatus)}`} />
                            </span>
                            <div>
                              <p className="font-mono font-medium text-foreground text-sm">{name}</p>
                              <p className="text-xs text-muted-foreground">
                                {cluster} · ns: {namespace}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {getEnvironmentLabel(environment)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs normal-case px-2 py-0.5">
                                {tag}
                              </Badge>
                            ))}
                            {tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                +{tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="w-24">
                            {worker ? (
                              <>
                                <p className="text-sm text-muted-foreground">
                                  {worker.onlineAgents}/{worker.desiredAgents}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agents</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">-/-</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={displayStatus} className="normal-case" />
                          {worker?.currentTask && (
                            <div className="mt-1">
                              <span className="text-[10px] font-mono text-warning bg-warning/10 px-2 py-0.5 rounded">
                                {worker.currentTask}
                              </span>
                            </div>
                          )}
                          {!worker && registration && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {registrationStatusLabel(registration.status)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-xs text-muted-foreground">
                            {worker
                              ? formatHeartbeat(worker.lastHeartbeat)
                              : `Created ${formatHeartbeat(registration?.createdAt ?? '')}`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {worker ? (
                                <>
                                  <DropdownMenuItem onSelect={() => handleConfigureWorker(worker)}>
                                    <Settings2 className="w-4 h-4 mr-2" />
                                    Configure worker
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setSelectedWorker(worker);
                                      setRestartOpen(true);
                                    }}
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Restart worker
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={() => {
                                      setSelectedWorker(worker);
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                registration && (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        void handleRegistrationTokenFromRow(registration);
                                      }}
                                      disabled={isRegeneratingToken}
                                    >
                                      <KeyRound className="w-4 h-4 mr-2" />
                                      {isRegeneratingToken ? 'Generating token...' : 'Generate token & command'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onSelect={() => {
                                        setSelectedRegistration(registration);
                                        setDeleteRegistrationOpen(true);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete registration
                                    </DropdownMenuItem>
                                  </>
                                )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWorkers.length === 0 && (
                    <TableEmptyRow
                      colSpan={7}
                      icon={<Cpu className="h-5 w-5 text-muted-foreground" />}
                      title={workerListRows.length === 0 ? 'No workers or registrations yet' : 'No workers match the current filters'}
                      description={
                        workerListRows.length === 0
                          ? 'Register the first worker to bootstrap deploy execution and cluster discovery.'
                          : 'Adjust the environment or status filters to reveal a different set of workers.'
                      }
                      actionLabel={workerListRows.length === 0 ? 'Register worker' : undefined}
                      onAction={workerListRows.length === 0 ? () => setRegisterOpen(true) : undefined}
                    />
                  )}
                </tbody>
              </table>
            </div>
            {filteredWorkers.length > 0 && (
              <TablePagination
                page={workersPagination.page}
                pageSize={workersPagination.pageSize}
                totalItems={filteredWorkers.length}
                totalPages={workersPagination.totalPages}
                onPageChange={workersPagination.setPage}
              />
            )}
          </div>
        </div>
      </div>

      <Dialog open={configureOpen} onOpenChange={setConfigureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Worker</DialogTitle>
            <DialogDescription>
              Update the worker name and tags. The environment is locked after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="worker-name">Worker name</Label>
              <Input
                id="worker-name"
                value={configName}
                onChange={(event) => setConfigName(event.target.value)}
                placeholder="e.g., prod-runner-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={configEnvironment} onValueChange={(value) => setConfigEnvironment(value as Environment)} disabled>
                <SelectTrigger disabled>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {environmentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Environment cannot be changed after the worker is created.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-tags">Tags</Label>
              <Input
                id="worker-tags"
                value={configTags}
                onChange={(event) => setConfigTags(event.target.value)}
                placeholder="e.g., prod, build, ci"
              />
              <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div>
                <p className="text-sm font-medium text-foreground">Registration token</p>
                <p className="text-xs text-muted-foreground">
                  Regenerate a token if this worker needs to be reinstalled.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerateToken}
                disabled={isRegeneratingToken}
              >
                {isRegeneratingToken ? 'Regenerating...' : 'Regenerate token'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigureOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfiguration}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionModal
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="Restart worker"
        description="This will restart the worker pods in the cluster."
        details={
          selectedWorker && (
            <p className="text-sm text-muted-foreground">
              You are about to restart <span className="font-mono text-foreground">{selectedWorker.name}</span>.
            </p>
          )
        }
        variant="warning"
        confirmLabel="Restart worker"
        onConfirm={handleRestartWorker}
      />

      <ConfirmActionModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete worker"
        description="This will remove the worker from the platform and revoke linked registration tokens."
        details={
          selectedWorker && (
            <p className="text-sm text-muted-foreground">
              You are about to delete <span className="font-mono text-foreground">{selectedWorker.name}</span>.
            </p>
          )
        }
        variant="destructive"
        confirmPhrase="delete"
        confirmLabel="Delete worker"
        onConfirm={handleDeleteWorker}
      />

      <ConfirmActionModal
        open={deleteRegistrationOpen}
        onOpenChange={setDeleteRegistrationOpen}
        title="Delete worker registration"
        description="This will revoke the worker registration token and remove the entry."
        details={
          selectedRegistration && (
            <p className="text-sm text-muted-foreground">
              You are about to revoke <span className="font-mono text-foreground">{selectedRegistration.name}</span>.
            </p>
          )
        }
        variant="destructive"
        confirmPhrase="delete"
        confirmLabel="Delete registration"
        onConfirm={handleDeleteRegistration}
      />

      {/* Create Registration Modal */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Worker</DialogTitle>
            <DialogDescription>
              Generate a token to install a worker in your Kubernetes cluster
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Worker name</Label>
              <Input
                id="reg-name"
                value={registrationName}
                onChange={(e) => setRegistrationName(e.target.value)}
                placeholder="e.g., prod-runner-01"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={registrationEnvironment} onValueChange={(v) => setRegistrationEnvironment(v as Environment)}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {environmentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-cluster">Cluster name</Label>
                <Input
                  id="reg-cluster"
                  value={registrationCluster}
                  onChange={(e) => setRegistrationCluster(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-ns">Namespace prefix</Label>
                <Input
                  id="reg-ns"
                  value={registrationNamespacePrefix}
                  onChange={(e) => setRegistrationNamespacePrefix(e.target.value)}
                  className="bg-muted/50"
                  placeholder="e.g., releasea-apps"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-tags">Tags (comma-separated)</Label>
              <Input
                id="reg-tags"
                value={registrationTags}
                onChange={(e) => setRegistrationTags(e.target.value)}
                placeholder="e.g., dev, build, docker"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-notes">Notes (optional)</Label>
              <Textarea
                id="reg-notes"
                value={registrationNotes}
                onChange={(e) => setRegistrationNotes(e.target.value)}
                placeholder="Internal notes about this worker"
                className="bg-muted/50"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRegistration} className="gap-2">
              <KeyRound className="w-4 h-4" />
              Create Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Command Modal */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Install Worker</DialogTitle>
            <DialogDescription>
              Install your worker with the Helm command below.
            </DialogDescription>
          </DialogHeader>
          {activeRegistration && (
            <div className="space-y-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{activeRegistration.name}</Badge>
                <Badge variant="secondary">{getEnvironmentLabel(activeRegistration.environment)}</Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  ns: {activeRegistration.namespace || effectiveBootstrapProfile.platformNamespace}
                </Badge>
                {activeRegistration.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  If you have questions about workers and multi-environment setup, check the{' '}
                  <a
                    href={workerDocsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    documentation
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  .
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Helm install command</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const installCommand = buildInstallCommand(activeRegistration);
                      navigator.clipboard.writeText(installCommand);
                      toast({ title: 'Helm command copied', description: 'Install command copied to clipboard.' });
                    }}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy command
                  </Button>
                </div>
                <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                  {buildInstallCommand(activeRegistration)}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Use this command to install and register the worker in the current environment.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
                <div className="flex gap-2">
                  <Input
                    value={activeRegistration.token ?? ''}
                    readOnly
                    className="bg-muted/50 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    disabled={!activeRegistration.token}
                    onClick={() => {
                      if (!activeRegistration.token) return;
                      navigator.clipboard.writeText(activeRegistration.token);
                      toast({ title: 'Token copied', description: 'Token copied to clipboard.' });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              {activeRegistration.notes && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Notes:</span> {activeRegistration.notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setInstallOpen(false)} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={poolDetailsOpen} onOpenChange={setPoolDetailsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Worker pool details</DialogTitle>
            <DialogDescription>
              Review the workers and registrations that currently back this execution pool.
            </DialogDescription>
          </DialogHeader>
          {selectedPool && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{getEnvironmentLabel(selectedPool.environment)}</Badge>
                <Badge variant="secondary">{selectedPool.cluster || 'unassigned-cluster'}</Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedPool.namespacePrefix || 'no-namespace-prefix'}
                </Badge>
                {selectedPool.tags.length > 0 ? (
                  selectedPool.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    No tags
                  </Badge>
                )}
                {selectedPool.maintenanceEnabled ? (
                  <Badge variant="destructive" className="text-xs">
                    Maintenance
                  </Badge>
                ) : null}
                {selectedPool.drainEnabled ? (
                  <Badge variant="outline" className="text-xs border-warning/60 text-warning">
                    Draining
                  </Badge>
                ) : null}
                {selectedPool.compatible && selectedPool.fallbackRank ? (
                  <Badge variant="secondary" className="text-xs">
                    Fallback #{selectedPool.fallbackRank}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workers</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedPool.workerCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agent capacity</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedPool.availableAgents}/{selectedPool.onlineAgents}/{selectedPool.desiredAgents}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Registrations</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedPool.activeRegistrations}/{selectedPool.registrationCount} active</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                Capacity state: <span className="font-medium text-foreground">{poolCapacityLabel(selectedPool.capacityState)}</span>
                {' · '}
                Score <span className="font-medium text-foreground">{selectedPool.capacityScore}/100</span>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>
                    Saturation: <span className="font-medium text-foreground">{poolSaturationLabel(selectedPool.saturationState)}</span>
                  </span>
                  <span className="font-medium text-foreground">{selectedPool.saturationPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${poolSaturationBarClass(selectedPool.saturationState)}`}
                    style={{ width: `${selectedPool.saturationPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Pool maintenance mode</p>
                    <p className="text-xs text-muted-foreground">
                      Maintenance pools stay visible in inventory but are excluded from routing and fallback ranking.
                    </p>
                  </div>
                  <Button
                    variant={selectedPool.maintenanceEnabled ? 'outline' : 'default'}
                    size="sm"
                    disabled={isPoolMaintenanceSaving}
                    onClick={() => void handleSetPoolMaintenance(selectedPool, !selectedPool.maintenanceEnabled)}
                  >
                    {selectedPool.maintenanceEnabled ? 'Disable maintenance' : 'Enable maintenance'}
                  </Button>
                </div>
                {selectedPool.maintenanceEnabled ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Reason: <span className="text-foreground">{selectedPool.maintenanceReason || 'No reason recorded'}</span>
                    </p>
                    {selectedPool.maintenanceUpdatedAt ? (
                      <p>
                        Updated {formatHeartbeat(selectedPool.maintenanceUpdatedAt)}
                        {selectedPool.maintenanceUpdatedBy ? ` by ${selectedPool.maintenanceUpdatedBy}` : ''}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="pool-maintenance-reason">Maintenance reason</Label>
                    <Textarea
                      id="pool-maintenance-reason"
                      value={poolMaintenanceReason}
                      onChange={(event) => setPoolMaintenanceReason(event.target.value)}
                      rows={3}
                      className="bg-background"
                      placeholder="Planned cluster maintenance, capacity isolation, dependency change..."
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Pool drain mode</p>
                    <p className="text-xs text-muted-foreground">
                      Draining keeps the pool visible and lets in-flight work finish, but prevents new operations from being claimed.
                    </p>
                  </div>
                  <Button
                    variant={selectedPool.drainEnabled ? 'outline' : 'default'}
                    size="sm"
                    disabled={selectedPool.maintenanceEnabled || isPoolDrainSaving}
                    onClick={() => void handleSetPoolDrain(selectedPool, !selectedPool.drainEnabled)}
                  >
                    {selectedPool.drainEnabled ? 'Disable drain' : 'Enable drain'}
                  </Button>
                </div>
                {selectedPool.maintenanceEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    Disable maintenance mode before enabling drain mode on this pool.
                  </p>
                ) : null}
                {selectedPool.drainEnabled ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Reason: <span className="text-foreground">{selectedPool.drainReason || 'No reason recorded'}</span>
                    </p>
                    {selectedPool.drainUpdatedAt ? (
                      <p>
                        Updated {formatHeartbeat(selectedPool.drainUpdatedAt)}
                        {selectedPool.drainUpdatedBy ? ` by ${selectedPool.drainUpdatedBy}` : ''}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="pool-drain-reason">Drain reason</Label>
                    <Textarea
                      id="pool-drain-reason"
                      value={poolDrainReason}
                      onChange={(event) => setPoolDrainReason(event.target.value)}
                      rows={3}
                      className="bg-background"
                      placeholder="Scale down this cluster, migrate work elsewhere, or finish current traffic before maintenance..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Workers</p>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {selectedPoolWorkers.length > 0 ? (
                    selectedPoolWorkers.map((worker) => (
                      <div key={worker.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <div>
                          <p className="font-mono text-foreground">{worker.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {worker.namespace} · {worker.onlineAgents}/{worker.desiredAgents} agents
                          </p>
                        </div>
                        <StatusBadge status={worker.status} className="normal-case" />
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">No live workers currently match this pool.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Registrations</p>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {selectedPoolRegistrations.length > 0 ? (
                    selectedPoolRegistrations.map((registration) => (
                      <div key={registration.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <div>
                          <p className="font-mono text-foreground">{registration.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {registration.namespace || effectiveBootstrapProfile.platformNamespace}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {registrationStatusLabel(registration.status)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">No registrations currently match this pool.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Workers;
