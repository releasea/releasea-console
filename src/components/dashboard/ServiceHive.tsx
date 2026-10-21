import { useNavigate } from 'react-router-dom';
import type { Deploy, Service, ServiceType } from '@/types/releasea';
import { isFailedDeployStatus, isLiveDeployStatus, resolveServiceStatusForDisplay } from '@/lib/deploy-status';
import { cn } from '@/lib/utils';

const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
const COLUMNS = 4;

const latestDeploy = (serviceId: string, deploys: Deploy[]) =>
  [...deploys]
    .filter((deploy) => deploy.serviceId === serviceId)
    .sort((a, b) => Date.parse(b.startedAt || b.createdAt || b.updatedAt || '') - Date.parse(a.startedAt || a.createdAt || a.updatedAt || ''))[0];

const liveDeploy = (serviceId: string, deploys: Deploy[]) =>
  [...deploys]
    .filter((deploy) => deploy.serviceId === serviceId && isLiveDeployStatus(deploy.status))
    .sort((a, b) => Date.parse(b.startedAt || b.createdAt || b.updatedAt || '') - Date.parse(a.startedAt || a.createdAt || a.updatedAt || ''))[0];

export const displayedServiceStatus = (service: Service, deploys: Deploy[]) => {
  const latest = latestDeploy(service.id, deploys);
  const live = liveDeploy(service.id, deploys);
  return String(resolveServiceStatusForDisplay({
    service,
    environment: live?.environment ?? latest?.environment,
    latestDeployStatus: live?.status ?? null,
  }));
};

export const serviceNeedsAttention = (service: Service, deploys: Deploy[]) => {
  const latest = latestDeploy(service.id, deploys);
  const live = liveDeploy(service.id, deploys);
  const display = displayedServiceStatus(service, deploys);
  if (display === 'error' || display === 'stopped') return true;
  return Boolean(latest && !live && isFailedDeployStatus(latest.status));
};

const typeLabel = (type: ServiceType) => {
  if (type === 'static-site') return 'Static site';
  if (type === 'worker') return 'Worker';
  return 'Microservice';
};

const statusLabel = (display: string, attention: boolean) => {
  if (attention) return 'Needs attention';
  if (display === 'running') return 'Running';
  return display.replace(/-/g, ' ');
};

type ServiceHiveProps = {
  services: Service[];
  deploys: Deploy[];
};

export function ServiceHive({ services, deploys }: ServiceHiveProps) {
  const navigate = useNavigate();
  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">This project has no services yet.</p>;
  }

  const rows: Service[][] = [];
  for (let index = 0; index < services.length; index += COLUMNS) {
    rows.push(services.slice(index, index + COLUMNS));
  }

  return (
    <div className="mx-auto w-fit max-w-full pb-2">
      {rows.map((row, rowIndex) => (
        <div
          key={row.map((service) => service.id).join('-')}
          className="flex"
          style={{
            gap: 14,
            marginTop: rowIndex === 0 ? 0 : -30,
            paddingLeft: rowIndex % 2 === 1 ? 72 : 0,
          }}
        >
          {row.map((service) => {
            const attention = serviceNeedsAttention(service, deploys);
            const display = displayedServiceStatus(service, deploys);
            const running = display === 'running';
            const label = statusLabel(display, attention);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => navigate(`/services/${service.id}`)}
                className="group relative h-[152px] w-[132px] shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${service.name}, ${label}`}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 transition-colors',
                    attention ? 'bg-warning/80' : running ? 'bg-success/55' : 'bg-border',
                  )}
                  style={{ clipPath: HEX }}
                />
                <span
                  className="absolute inset-[1.5px] flex flex-col items-center justify-center bg-card px-5 text-center transition-colors group-hover:bg-muted/50"
                  style={{ clipPath: HEX }}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        attention ? 'bg-warning' : running ? 'bg-success' : 'bg-muted-foreground/60',
                      )}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-medium uppercase tracking-[0.14em]',
                        attention ? 'text-warning' : running ? 'text-success' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-[13px] font-medium leading-4 tracking-tight text-foreground">
                    {service.name}
                  </span>
                  <span className="mt-1 text-[10px] text-muted-foreground">{typeLabel(service.type)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
