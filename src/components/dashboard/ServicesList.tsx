import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MoreVertical, Play, Rocket, Square, Server, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Deploy, Metrics, Project, Service } from '@/types/releasea';
import { StatusBadge } from '@/components/ui/status-badge';
import { ServiceTypeIcon } from '@/components/ui/service-type-icon';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useTablePagination } from '@/hooks/use-table-pagination';
import { TablePagination } from '@/components/layout/TablePagination';
import { TableEmptyRow } from '@/components/layout/EmptyState';
import { fetchMetrics, fetchProjects } from '@/lib/data';
import { usePlatformPreferences } from '@/contexts/PlatformPreferencesContext';
import { isLiveDeployStatus, resolveServiceStatusForDisplay } from '@/lib/deploy-status';

interface ServicesListProps {
  services: Service[];
  deploys?: Deploy[];
  projects?: Project[];
  showProject?: boolean;
  showHeader?: boolean;
  title?: string;
  meta?: string;
  showActions?: boolean;
  origin?: {
    pathname: string;
    label?: string;
  };
}

const METRICS_WINDOW_MINUTES = 60;

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

const getDeployTimestamp = (deploy: Deploy) => {
  const reference = deploy.startedAt ?? deploy.createdAt;
  return reference ? new Date(reference).getTime() : 0;
};

export function ServicesList({
  services,
  deploys,
  projects,
  showProject = true,
  showHeader = false,
  title = 'Services',
  meta,
  showActions = true,
  origin,
}: ServicesListProps) {
  const navigate = useNavigate();
  const { preferences } = usePlatformPreferences();
  const pagination = useTablePagination(services.length);
  const visibleServices = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    return services.slice(startIndex, startIndex + pagination.pageSize);
  }, [pagination.page, pagination.pageSize, services]);
  const columnCount = 6 + (showProject ? 1 : 0) + (showActions ? 1 : 0);
  const [loadedProjects, setLoadedProjects] = useState<Project[]>([]);
  const [metricsByService, setMetricsByService] = useState<Record<string, Metrics>>({});

  useEffect(() => {
    if (projects) return;
    let active = true;
    const load = async () => {
      const data = await fetchProjects();
      if (!active) return;
      setLoadedProjects(data);
    };
    load();
    return () => {
      active = false;
    };
  }, [projects]);

  const resolvedProjects = useMemo(() => projects ?? loadedProjects, [projects, loadedProjects]);
  const resolvedDeploys = useMemo(() => deploys ?? [], [deploys]);

  const getProjectName = (projectId: string) => {
    return resolvedProjects.find((project) => project.id === projectId)?.name || 'N/A';
  };

  const latestDeployByService = useMemo(() => {
    const map = new Map<string, Deploy>();
    resolvedDeploys.forEach((deploy) => {
      const current = map.get(deploy.serviceId);
      if (!current || getDeployTimestamp(deploy) > getDeployTimestamp(current)) {
        map.set(deploy.serviceId, deploy);
      }
    });
    return map;
  }, [resolvedDeploys]);

  const latestLiveDeployByService = useMemo(() => {
    const map = new Map<string, Deploy>();
    resolvedDeploys.forEach((deploy) => {
      if (!isLiveDeployStatus(deploy.status)) {
        return;
      }
      const current = map.get(deploy.serviceId);
      if (!current || getDeployTimestamp(deploy) > getDeployTimestamp(current)) {
        map.set(deploy.serviceId, deploy);
      }
    });
    return map;
  }, [resolvedDeploys]);

  const metricsTargets = useMemo(
    () => visibleServices.filter((service) => service.type === 'microservice'),
    [visibleServices],
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

  const navigateToService = (serviceId: string) => {
    if (origin) {
      navigate(`/services/${serviceId}`, { state: { from: origin } });
      return;
    }
    navigate(`/services/${serviceId}`);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {showHeader && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Service
              </th>
              {showProject && (
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Project
                </th>
              )}
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Active
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                CPU
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                Memory
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                Last deploy
              </th>
              {showActions && (
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleServices.map((service) => (
              <tr 
                key={service.id} 
                role="button"
                tabIndex={0}
                onClick={() => navigateToService(service.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigateToService(service.id);
                  }
                }}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ServiceTypeIcon type={service.type} size="sm" />
                    <div>
                      <p className="font-mono font-medium text-foreground">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.type}</p>
                    </div>
                  </div>
                </td>
                {showProject && (
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{getProjectName(service.projectId)}</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  {(() => {
                    const liveDeploy = latestLiveDeployByService.get(service.id);
                    const latestDeploy = latestDeployByService.get(service.id);
                    const displayStatus = resolveServiceStatusForDisplay({
                      service,
                      environment: liveDeploy?.environment ?? latestDeploy?.environment,
                      latestDeployStatus: liveDeploy?.status ?? null,
                    });
                    return <StatusBadge status={displayStatus} />;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {service.isActive ?? true ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {(() => {
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
                  })()}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {(() => {
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
                  })()}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {service.lastDeployAt
                      ? format(new Date(service.lastDeployAt), 'MMM dd, HH:mm')
                      : 'N/A'}
                  </span>
                </td>
                {showActions && (
                  <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigateToService(service.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View details
                          </DropdownMenuItem>
                          {service.url && (
                            <DropdownMenuItem>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open URL
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Rocket className="w-4 h-4 mr-2" />
                            Deploy service
                          </DropdownMenuItem>
                          {service.status === 'running' ? (
                            <DropdownMenuItem>
                              <Square className="w-4 h-4 mr-2" />
                              Stop service
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem>
                              <Play className="w-4 h-4 mr-2" />
                              Start service
                            </DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
            {services.length === 0 && (
              <TableEmptyRow
                colSpan={columnCount}
                icon={<Server className="h-5 w-5 text-muted-foreground" />}
              />
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={services.length}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setPage}
      />
    </div>
  );
}
