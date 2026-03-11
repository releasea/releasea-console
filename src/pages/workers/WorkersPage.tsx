import { useEffect, useRef, useState } from 'react';
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
import { TableEmptyRow } from '@/components/layout/EmptyState';
import { ConfirmActionModal } from '@/components/modals/ConfirmActionModal';
import { toast } from '@/hooks/use-toast';
import { useTablePagination } from '@/hooks/use-table-pagination';
import { Environment, Worker, WorkerRegistration, WorkerStatus } from '@/types/releasea';
import { getEnvironmentConfigs, getEnvironmentLabel } from '@/lib/environments';
import { StatusBadge } from '@/components/ui/status-badge';
import { createWorkerRegistration, deleteWorker, fetchWorkerRegistrations, fetchWorkers, restartWorker, updateWorker } from '@/lib/data';

const defaultInternalDomain = import.meta.env.RELEASEA_INTERNAL_DOMAIN?.trim() || 'releasea.internal';
const defaultExternalDomain = import.meta.env.RELEASEA_EXTERNAL_DOMAIN?.trim() || 'releasea.external';
const defaultIstioNamespace = import.meta.env.RELEASEA_ISTIO_NAMESPACE?.trim() || 'istio-system';
const defaultInternalGatewayName = import.meta.env.RELEASEA_INTERNAL_GATEWAY_NAME?.trim() || 'releasea-internal-gateway';
const defaultExternalGatewayName = import.meta.env.RELEASEA_EXTERNAL_GATEWAY_NAME?.trim() || 'releasea-external-gateway';
const defaultPlatformNamespace = import.meta.env.RELEASEA_PLATFORM_NAMESPACE?.trim() || 'releasea-system';
const defaultWorkerInstallNamespace = defaultPlatformNamespace;
const defaultWorkerNamespacePrefix = 'releasea-apps';
const defaultWorkerAPIBaseUrl = import.meta.env.RELEASEA_WORKER_API_BASE_URL?.trim()
  || `http://releasea-api.${defaultPlatformNamespace}.svc.cluster.local:8070/api/v1`;

const buildInstallCommand = (registration: WorkerRegistration) => {
  const tags = registration.tags.length > 0 ? registration.tags.join(',') : registration.environment;
  const registrationToken = registration.token?.trim() || '<generate-token-first>';
  const workerNamespace = registration.namespace?.trim() || defaultWorkerInstallNamespace;
  const namespacePrefix = registration.namespacePrefix?.trim() || defaultWorkerNamespacePrefix;
  return [
    'helm repo add releasea https://releasea.github.io/releasea-charts',
    'helm repo update',
    `INTERNAL_DOMAIN="\${RELEASEA_INTERNAL_DOMAIN:-$(kubectl -n ${defaultIstioNamespace} get gateway ${defaultInternalGatewayName} -o jsonpath='{.spec.servers[0].hosts[0]}' 2>/dev/null | sed -E 's/^\\*\\.//')}"`,
    `EXTERNAL_DOMAIN="\${RELEASEA_EXTERNAL_DOMAIN:-$(kubectl -n ${defaultIstioNamespace} get gateway ${defaultExternalGatewayName} -o jsonpath='{.spec.servers[0].hosts[0]}' 2>/dev/null | sed -E 's/^\\*\\.//')}"`,
    `[ -z "$INTERNAL_DOMAIN" ] && INTERNAL_DOMAIN="${defaultInternalDomain}"`,
    `[ -z "$EXTERNAL_DOMAIN" ] && EXTERNAL_DOMAIN="${defaultExternalDomain}"`,
    `helm upgrade --install releasea-worker releasea/releasea-worker \\`,
    `  --namespace ${workerNamespace} --create-namespace \\`,
    `  --set token=${registrationToken} \\`,
    `  --set namespacePrefix=${namespacePrefix} \\`,
    `  --set environment=${registration.environment} \\`,
    `  --set tags=${tags} \\`,
    `  --set worker.name=${registration.name} \\`,
    `  --set-string api.baseUrl=${defaultWorkerAPIBaseUrl} \\`,
    `  --set-string global.routing.internalDomain=$INTERNAL_DOMAIN \\`,
    `  --set-string global.routing.externalDomain=$EXTERNAL_DOMAIN`,
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
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [configName, setConfigName] = useState('');
  const [configEnvironment, setConfigEnvironment] = useState<Environment>('dev');
  const [configTags, setConfigTags] = useState('');
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState<Environment | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | 'all'>('all');

  useEffect(() => {
    if (searchParams.get('action') !== 'register') return;
    setRegisterOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const environmentOptions = getEnvironmentConfigs();
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [workersData, registrationsData] = await Promise.all([
        fetchWorkers(),
        fetchWorkerRegistrations(),
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
      setRegistrations(registrationsData);
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
        namespacePrefix: seed.namespacePrefix?.trim() || defaultWorkerNamespacePrefix,
        namespace: seed.namespace?.trim() || defaultWorkerInstallNamespace,
        createdAt: now.toISOString(),
        token: createTokenValue(),
        status: 'unused',
        notes: seed.notes,
      };

      const savedRegistration = await createWorkerRegistration(nextRegistration);
      setRegistrations((prev) => [savedRegistration, ...prev]);
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
    const nextWorkers = await fetchWorkers();
    setWorkers(nextWorkers);
    toast({
      title: 'Worker deleted',
      description: `Worker "${selectedWorker.name}" removed.`,
    });
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
        namespacePrefix: registrationNamespacePrefix.trim() || defaultWorkerNamespacePrefix,
        namespace: defaultWorkerInstallNamespace,
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
      label: 'Environments', 
      value: environmentOptions.length.toString(),
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
                    const namespace = worker?.namespace ?? registration?.namespace ?? defaultWorkerInstallNamespace;
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
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      void handleRegistrationTokenFromRow(registration);
                                    }}
                                    disabled={isRegeneratingToken}
                                  >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    {isRegeneratingToken ? 'Generating token...' : 'Generate token & command'}
                                  </DropdownMenuItem>
                                )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWorkers.length === 0 && (
                    <TableEmptyRow colSpan={7} icon={<Cpu className="h-5 w-5 text-muted-foreground" />} />
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
        description="This will remove the worker from the platform."
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
              Run this command in your Kubernetes cluster to register the worker
            </DialogDescription>
          </DialogHeader>
          {activeRegistration && (
            <div className="space-y-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{activeRegistration.name}</Badge>
                <Badge variant="secondary">{getEnvironmentLabel(activeRegistration.environment)}</Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  ns: {activeRegistration.namespace}
                </Badge>
                {activeRegistration.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Helm install command</Label>
                <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                  {buildInstallCommand(activeRegistration)}
                </pre>
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
    </AppLayout>
  );
};

export default Workers;
