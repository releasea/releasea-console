import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, ExternalLink, Play, Square, Rocket, Filter, Server, Activity, Eye } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { DataTable, Column } from '@/components/layout/DataTable';
import { TableFiltersBar } from '@/components/layout/TableFiltersBar';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ServiceTypeIcon } from '@/components/ui/service-type-icon';
import { Progress } from '@/components/ui/progress';
import { Deploy, DeployStatusValue, Metrics, Project, Service, ServiceType, ServicesStatusSnapshot } from '@/types/releasea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fetchDeploys, fetchMetrics, fetchProjects, fetchServices } from '@/lib/data';
import { toast } from '@/hooks/use-toast';
import { usePlatformPreferences } from '@/contexts/PlatformPreferencesContext';
import { isLiveDeployStatus, parseDeployTimestamp, resolveServiceStatusForDisplay } from '@/lib/deploy-status';
import { apiClient } from '@/lib/api-client';
import { useSSEStream } from '@/lib/use-sse-stream';

type ServiceFilter = Exclude<ServiceType, 'worker'> | 'all';

const serviceTypes: { value: ServiceFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'microservice', label: 'Microservices' },
  { value: 'static-site', label: 'Static sites' },
];

const METRICS_WINDOW_MINUTES = 60;
const SERVICES_POLL_INTERVAL_MS = 20000;
const SERVICES_POLL_FAST_INTERVAL_MS = 5000;
const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getLastMetricValue = (values?: number[]): number | null => {
  if (!values || values.length === 0) return null;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

const getDeployTimestamp = (deploy: Deploy) => parseDeployTimestamp(deploy.startedAt, deploy.createdAt);

const Services = () => {
  const navigate = useNavigate();
  const { preferences } = usePlatformPreferences();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ServiceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [metricsByService, setMetricsByService] = useState<Record<string, Metrics>>({});
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const applyServicesSnapshot = useCallback((snapshot: ServicesStatusSnapshot) => {
    setServices(Array.isArray(snapshot.services) ? snapshot.services : []);
    setDeploys(Array.isArray(snapshot.deploys) ? snapshot.deploys : []);
    setLastSyncAt(Date.now());
    setSyncError(null);
  }, []);

  const loadServicesSnapshot = useCallback(async () => {
    const response = await apiClient.get<ServicesStatusSnapshot>('/services/status');
    if (response.error || !response.data) {
      throw new Error(response.error ?? 'Unable to load service status.');
    }
    applyServicesSnapshot(response.data);
  }, [applyServicesSnapshot]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const projectsData = await fetchProjects();
      if (!active) return;
      setProjects(projectsData);
      try {
        await loadServicesSnapshot();
      } catch {
        if (!active) return;
        const [servicesData, deploysData] = await Promise.all([fetchServices(), fetchDeploys()]);
        if (!active) return;
        setServices(servicesData);
        setDeploys(deploysData);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadServicesSnapshot]);

  const { isConnected: isLiveSyncConnected } = useSSEStream<ServicesStatusSnapshot>({
    endpoint: '/services/status/stream',
    onSnapshot: applyServicesSnapshot,
    onError: setSyncError,
  });

  useEffect(() => {
    if (isLiveSyncConnected) {
      return;
    }
    const hasLiveDeploy = deploys.some((deploy) => isLiveDeployStatus(deploy.status));
    const intervalMs = hasLiveDeploy ? SERVICES_POLL_FAST_INTERVAL_MS : SERVICES_POLL_INTERVAL_MS;
    const interval = window.setInterval(() => {
      void loadServicesSnapshot().catch(() => {
        setSyncError('Unable to refresh service list.');
      });
    }, intervalMs);
    return () => {
      window.clearInterval(interval);
    };
  }, [deploys, isLiveSyncConnected, loadServicesSnapshot]);

  const visibleServices = useMemo(
    () => services.filter((service) => service.type !== 'worker'),
    [services],
  );

  const latestDeployByService = useMemo(() => {
    const map = new Map<string, Deploy>();
    deploys.forEach((deploy) => {
      const current = map.get(deploy.serviceId);
      if (!current || getDeployTimestamp(deploy) > getDeployTimestamp(current)) {
        map.set(deploy.serviceId, deploy);
      }
    });
    return map;
  }, [deploys]);

  const getProjectName = (projectId: string) => {
    return projects.find((project) => project.id === projectId)?.name || 'N/A';
  };

  const typeCounts: Record<ServiceFilter, number> = {
    all: visibleServices.length,
    microservice: visibleServices.filter(s => s.type === 'microservice').length,
    'static-site': visibleServices.filter(s => s.type === 'static-site').length,
  };

  const activeDeployStatusByService = useMemo(() => {
    const latestActiveDeployByService = new Map<string, Deploy>();
    deploys.forEach((deploy) => {
      if (!isLiveDeployStatus(deploy.status)) {
        return;
      }
      const current = latestActiveDeployByService.get(deploy.serviceId);
      if (!current || getDeployTimestamp(deploy) > getDeployTimestamp(current)) {
        latestActiveDeployByService.set(deploy.serviceId, deploy);
      }
    });
    const map = new Map<string, DeployStatusValue>();
    latestActiveDeployByService.forEach((deploy, serviceId) => {
      map.set(serviceId, deploy.status);
    });
    return map;
  }, [deploys]);

  const displayStatusByService = useMemo(() => {
    const map = new Map<string, string>();
    visibleServices.forEach((service) => {
      const deployStatus = activeDeployStatusByService.get(service.id) ?? null;
      const deployEnvironment = latestDeployByService.get(service.id)?.environment;
      const displayStatus = resolveServiceStatusForDisplay({
        service,
        environment: deployEnvironment,
        latestDeployStatus: deployStatus,
      });
      map.set(service.id, displayStatus);
    });
    return map;
  }, [activeDeployStatusByService, latestDeployByService, visibleServices]);

  const filteredServices = useMemo(() => {
    return visibleServices.filter((service) => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || service.type === typeFilter;
      const displayStatus = displayStatusByService.get(service.id) ?? service.status;
      const matchesStatus = statusFilter === 'all' || displayStatus === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [displayStatusByService, searchQuery, statusFilter, typeFilter, visibleServices]);

  const metricsTargets = useMemo(
    () => filteredServices.filter((service) => service.type === 'microservice'),
    [filteredServices],
  );

  useEffect(() => {
    if (metricsTargets.length === 0) {
      return;
    }
    let active = true;
    const loadMetrics = async () => {
      const now = new Date();
      const from = new Date(now.getTime() - METRICS_WINDOW_MINUTES * 60 * 1000);
      const results = await Promise.all(
        metricsTargets.map(async (service) => {
          const environment = latestDeployByService.get(service.id)?.environment ?? 'prod';
          const metrics = await fetchMetrics(service.id, from, now, environment);
          return { id: service.id, metrics };
        }),
      );
      if (!active) return;
      setMetricsByService((prev) => {
        const next = { ...prev };
        results.forEach(({ id, metrics }) => {
          next[id] = metrics;
        });
        return next;
      });
    };
    loadMetrics();
    if (!preferences.autoRefreshMetrics) {
      return () => {
        active = false;
      };
    }
    const interval = window.setInterval(loadMetrics, preferences.metricsRefreshInterval * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [latestDeployByService, metricsTargets, preferences.autoRefreshMetrics, preferences.metricsRefreshInterval]);

  const columns: Column<Service>[] = [
    {
      key: 'service',
      header: 'Service',
      render: (service) => (
        <div className="flex items-center gap-3">
          <ServiceTypeIcon type={service.type} />
          <div>
            <p className="font-mono font-medium text-foreground">{service.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{service.type.replace('-', ' ')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      render: (service) => (
        <span className="text-sm text-muted-foreground">{getProjectName(service.projectId)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (service) => {
        const deployStatus = activeDeployStatusByService.get(service.id) ?? null;
        const displayStatus = displayStatusByService.get(service.id) ?? service.status;
        return (
          <div className="flex flex-col gap-2">
            <StatusBadge status={displayStatus} />
            {deployStatus && deployStatus !== displayStatus && <StatusBadge status={deployStatus} />}
          </div>
        );
      },
    },
    {
      key: 'active',
      header: 'Active',
      render: (service) => (
        <span className="text-sm text-muted-foreground">
          {service.isActive ?? true ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'cpu',
      header: 'CPU',
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      render: (service) => {
        const metrics = metricsByService[service.id];
        const rawValue = service.type === 'microservice' ? getLastMetricValue(metrics?.cpu) : null;
        const displayValue = rawValue === null ? '--' : `${Math.round(rawValue)}%`;
        const progressValue = rawValue === null ? 0 : clampPercent(rawValue);
        return (
          <div className="w-20">
            <div className="text-xs text-muted-foreground">{displayValue}</div>
            <Progress value={progressValue} className="mt-1 h-1.5" />
          </div>
        );
      },
    },
    {
      key: 'memory',
      header: 'Memory',
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      render: (service) => {
        const metrics = metricsByService[service.id];
        const rawValue = service.type === 'microservice' ? getLastMetricValue(metrics?.memory) : null;
        const displayValue = rawValue === null ? '--' : `${Math.round(rawValue)}%`;
        const progressValue = rawValue === null ? 0 : clampPercent(rawValue);
        return (
          <div className="w-20">
            <div className="text-xs text-muted-foreground">{displayValue}</div>
            <Progress value={progressValue} className="mt-1 h-1.5" />
          </div>
        );
      },
    },
    {
      key: 'lastDeploy',
      header: 'Last deploy',
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      render: (service) => (
        <span className="text-sm text-muted-foreground">
          {service.lastDeployAt ? format(new Date(service.lastDeployAt), 'MMM dd, HH:mm') : 'N/A'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (service) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/services/${service.id}`)}>
                <Eye className="w-4 h-4 mr-2" />
                View details
              </DropdownMenuItem>
              {service.url && (
                <DropdownMenuItem onClick={() => window.open(service.url, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open URL
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/services/${service.id}?tab=deploys`)}>
                <Rocket className="w-4 h-4 mr-2" />
                Deploy service
              </DropdownMenuItem>
              {service.status === 'running' ? (
                <DropdownMenuItem onClick={() => {
                  toast({ title: 'Stop requested', description: `Stopping ${service.name}...` });
                }}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop service
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => {
                  toast({ title: 'Start requested', description: `Starting ${service.name}...` });
                }}>
                  <Play className="w-4 h-4 mr-2" />
                  Start service
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const syncLabel = lastSyncAt ? format(new Date(lastSyncAt), 'HH:mm:ss') : '--';

  return (
    <AppLayout>
      <div className="space-y-6">
        <ListPageHeader
          title="Services"
          description="Manage microservices and sites"
          actions={
            <Button onClick={() => navigate('/services/new')}>
              <Plus className="w-4 h-4" />
              New Service
            </Button>
          }
        />

        <TableFiltersBar
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Search services...',
          }}
          selects={[
            {
              id: 'type',
              value: typeFilter,
              onValueChange: (value) => setTypeFilter(value as ServiceFilter),
              icon: <Filter className="h-4 w-4 text-muted-foreground" />,
              options: serviceTypes.map((type) => ({
                value: type.value,
                label: `${type.label} (${typeCounts[type.value]})`,
              })),
            },
            {
              id: 'status',
              value: statusFilter,
              onValueChange: setStatusFilter,
              placeholder: 'Status',
              icon: <Activity className="h-4 w-4 text-muted-foreground" />,
              options: [
                { value: 'all', label: 'All statuses' },
                { value: 'running', label: 'Running' },
                { value: 'stopped', label: 'Stopped' },
                { value: 'pending', label: 'Waiting' },
                { value: 'creating', label: 'Creating' },
                { value: 'created', label: 'Created' },
                { value: 'deleting', label: 'Deleting' },
                { value: 'idle', label: 'Not deployed' },
                { value: 'error', label: 'Error' },
              ],
            },
          ]}
        />

        <div className="px-1 text-xs text-muted-foreground">
          {syncError
            ? `Live sync delayed: ${syncError}`
            : `Live sync ${isLiveSyncConnected ? 'active' : 'polling'} • Last sync ${syncLabel}`}
        </div>

        <DataTable
          columns={columns}
          data={filteredServices}
          keyExtractor={(service) => service.id}
          onRowClick={(service) => navigate(`/services/${service.id}`)}
          emptyIcon={<Server className="h-5 w-5 text-muted-foreground" />}
        />
      </div>
    </AppLayout>
  );
};

export default Services;
