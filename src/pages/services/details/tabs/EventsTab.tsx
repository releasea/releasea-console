import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/layout/EmptyState';
import { TablePagination } from '@/components/layout/TablePagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { TabsContent } from '@/components/ui/tabs';
import type { Deploy, RuleDeploy } from '@/types/releasea';
import type { AuditLogEntry } from '@/types/governance';
import { AlertTriangle, Clock3, GitBranch, Rocket, Route as RouteIcon, ScrollText, Shield, TerminalSquare } from 'lucide-react';
import { ServiceTabHeader } from '../ServiceTabHeader';

const logsActionButtonClassName = 'h-9 w-full justify-start gap-2 px-3 sm:w-40';

type PaginationState = {
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (value: number) => void;
};

export type ServiceEvent =
  | {
      id: string;
      kind: 'deploy';
      status: Deploy['status'];
      label: string;
      branch?: string;
      environment?: string;
      triggeredBy?: string;
      timeLabel: string;
      time: number;
      deploy: Deploy;
    }
  | {
      id: string;
      kind: 'rule-deploy';
      status: RuleDeploy['status'];
      label: string;
      environment?: string;
      triggeredBy?: string;
      timeLabel: string;
      time: number;
      ruleDeploy: RuleDeploy;
    }
  | {
      id: string;
      kind: 'governance';
      status: 'failed';
      label: string;
      environment?: string;
      triggeredBy?: string;
      timeLabel: string;
      time: number;
      governanceEvent: AuditLogEntry;
    };

type EventsTabProps = {
  visibleEvents: ServiceEvent[];
  events: ServiceEvent[];
  deployEnvLabel: (env?: string) => string;
  pagination: PaginationState;
  onOpenDeployLog: (deploy: Deploy) => void;
  onOpenRuleRuntimeLogs: () => void;
  liveSyncError?: string | null;
  liveSyncLabel: string;
  liveSyncActive?: boolean;
  liveSyncPaused?: boolean;
  viewEnvLabel: string;
  onGoToSummary: () => void;
};

const eventKind = {
  deploy: { label: 'Deployment', icon: Rocket },
  'rule-deploy': { label: 'Traffic rule', icon: RouteIcon },
  governance: { label: 'Governance', icon: Shield },
} as const;

export const EventsTab = ({
  visibleEvents,
  events,
  deployEnvLabel,
  pagination,
  onOpenDeployLog,
  onOpenRuleRuntimeLogs,
  liveSyncError,
  liveSyncLabel,
  liveSyncActive = false,
  liveSyncPaused = false,
  viewEnvLabel,
  onGoToSummary,
}: EventsTabProps) => (
  <TabsContent value="events" className="space-y-4">
    <ServiceTabHeader
      title="Events"
      description="Deployments, traffic changes, and governance decisions in chronological order."
      environment={viewEnvLabel}
      actions={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {liveSyncError ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> : null}
          <span className={liveSyncError ? 'text-warning' : undefined}>
            {liveSyncError
              ? `Sync delayed · ${liveSyncLabel}`
              : liveSyncPaused
                ? `Sync paused · ${liveSyncLabel}`
                : `Sync ${liveSyncActive ? 'active' : 'idle'} · ${liveSyncLabel}`}
          </span>
        </div>
      }
    />

    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {visibleEvents.length > 0 ? (
        <ol className="p-5" aria-label="Service events timeline">
          {visibleEvents.map((event, index) => {
            const kind = eventKind[event.kind];
            const KindIcon = kind.icon;
            return (
              <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                  <KindIcon className="h-4 w-4" />
                </div>
                {index < visibleEvents.length - 1 ? (
                  <>
                    <span className="absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-border" aria-hidden="true" />
                    <span className="absolute bottom-3 left-12 right-0 h-px bg-border/60" aria-hidden="true" />
                  </>
                ) : null}

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-medium text-foreground">{event.label}</p>
                        <StatusBadge status={event.status} className="normal-case" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{kind.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{deployEnvLabel(event.environment)}</span>
                        {event.triggeredBy ? <><span aria-hidden="true">·</span><span>by {event.triggeredBy}</span></> : null}
                      </div>
                      {event.kind === 'deploy' && event.branch ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <GitBranch className="h-3.5 w-3.5" />
                          {event.branch}
                        </p>
                      ) : null}
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {event.timeLabel}
                      </p>
                    </div>

                    <div className="shrink-0 sm:pt-0.5">
                      {event.kind === 'deploy' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className={logsActionButtonClassName}
                          onClick={() => onOpenDeployLog(event.deploy)}
                        >
                          <ScrollText className="h-4 w-4 text-muted-foreground" />
                          Deployment log
                        </Button>
                      ) : event.kind === 'rule-deploy' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className={logsActionButtonClassName}
                          onClick={onOpenRuleRuntimeLogs}
                        >
                          <TerminalSquare className="h-4 w-4 text-muted-foreground" />
                          Runtime log
                        </Button>
                      ) : (
                        <div className="flex h-9 w-full items-center justify-start px-3 text-xs text-muted-foreground sm:w-40">
                          Policy decision
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          icon={<Rocket className="h-5 w-5 text-muted-foreground" />}
          title={`No activity in ${viewEnvLabel}`}
          description="Deploy this service or publish a traffic rule to create the first operational event."
          actionLabel="Review service"
          onAction={onGoToSummary}
          tone="muted"
        />
      )}

      {events.length > 0 ? (
        <div className="border-t border-border">
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={events.length}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
          />
        </div>
      ) : null}
    </div>
  </TabsContent>
);
