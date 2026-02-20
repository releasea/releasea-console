import { useEffect, useMemo, useState } from 'react';
import { GitBranch, Clock, User, Rocket } from 'lucide-react';
import { Deploy, Service } from '@/types/releasea';
import { StatusBadge } from '@/components/ui/status-badge';
import { format } from 'date-fns';
import { fetchServices } from '@/lib/data';
import { EmptyState } from '@/components/layout/EmptyState';

interface DeploysListProps {
  deploys: Deploy[];
  services?: Service[];
  showHeader?: boolean;
  title?: string;
  meta?: string;
}

export function DeploysList({ deploys, services, showHeader = true, title = 'Recent deploys', meta }: DeploysListProps) {
  const [loadedServices, setLoadedServices] = useState<Service[]>([]);
  const shortCommit = (commit?: string) => {
    const value = commit?.trim() ?? '';
    if (!value) return '';
    return value.length > 8 ? value.substring(0, 8) : value;
  };

  useEffect(() => {
    if (services) return;
    let active = true;
    const load = async () => {
      const data = await fetchServices();
      if (!active) return;
      setLoadedServices(data);
    };
    load();
    return () => {
      active = false;
    };
  }, [services]);

  const resolvedServices = useMemo(() => services ?? loadedServices, [services, loadedServices]);

  const getServiceName = (serviceId: string) => {
    const service = resolvedServices.find((item) => item.id === serviceId);
    return service?.name || serviceId;
  };

  const isEmpty = deploys.length === 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {showHeader && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{title}</h3>
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
          </div>
        </div>
      )}
      <div className={isEmpty ? '' : 'divide-y divide-border/50'}>
        {isEmpty ? (
          <div className={showHeader ? 'border-t border-border/50' : ''}>
            <EmptyState
              icon={<Rocket className="h-5 w-5 text-muted-foreground" />}
              title="Nothing here yet"
              description="You can add new items or adjust your search."
              tone="muted"
              className="py-10 min-h-[140px]"
            />
          </div>
        ) : (
          deploys.map((deploy) => (
            <div key={deploy.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {getServiceName(deploy.serviceId)}
                    </span>
                    <StatusBadge status={deploy.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {deploy.commit && (
                      <span className="flex items-center gap-1 font-mono">
                        <GitBranch className="w-3 h-3" />
                        {deploy.branch} · {shortCommit(deploy.commit)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {deploy.triggeredBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(deploy.startedAt), 'MMM dd, HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
