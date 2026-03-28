import { Button } from '@/components/ui/button';
import { TableEmptyRow } from '@/components/layout/EmptyState';
import { TablePagination } from '@/components/layout/TablePagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { TabsContent } from '@/components/ui/tabs';
import type { Deploy, RuleDeploy } from '@/types/releasea';
import type { AuditLogEntry } from '@/types/governance';
import { AlertTriangle, FileText, GitBranch, Rocket, Route as RouteIcon, Shield } from 'lucide-react';

const logsActionButtonClassName =
  'gap-2 border border-cyan-500/40 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 hover:text-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-500/25';
const logsActionIconWrapClassName =
  'inline-flex h-5 w-5 items-center justify-center rounded-sm bg-cyan-500/20 text-cyan-700 dark:text-cyan-200';

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
};

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
}: EventsTabProps) => (
  <TabsContent value="events" className="space-y-4">
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
      {liveSyncError ? (
        <span className="inline-flex items-center gap-1 text-warning">
          <AlertTriangle className="w-3 h-3" />
          Live sync delayed: {liveSyncError}
        </span>
      ) : (
        <span className="text-muted-foreground">
          Live sync {liveSyncActive ? 'active' : 'idle'} • Last sync {liveSyncLabel}
        </span>
      )}
    </div>
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Status
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Type
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Reference
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Environment
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Started by
            </th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Date
            </th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleEvents.map((event) => (
            <tr key={event.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <StatusBadge status={event.status} className="normal-case" />
              </td>
              <td className="px-4 py-3">
                {event.kind === 'deploy' ? (
                  <div className="flex items-center gap-1.5">
                    <Rocket className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Deploy</span>
                  </div>
                ) : event.kind === 'rule-deploy' ? (
                  <div className="flex items-center gap-1.5">
                    <RouteIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Rule deploy</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Governance</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {event.kind === 'deploy' ? (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm">{event.label}</span>
                    {event.branch && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="w-3 h-3" />
                        Branch {event.branch}
                      </span>
                    )}
                  </div>
                ) : event.kind === 'rule-deploy' ? (
                  <span className="font-mono text-sm">{event.label}</span>
                ) : (
                  <span className="text-sm text-foreground">{event.label}</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {deployEnvLabel(event.environment)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{event.triggeredBy}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{event.timeLabel}</td>
              <td className="px-4 py-3 text-right">
                {event.kind === 'deploy' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className={logsActionButtonClassName}
                    onClick={() => onOpenDeployLog(event.deploy)}
                  >
                    <span className={logsActionIconWrapClassName}>
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium">View logs</span>
                  </Button>
                ) : event.kind === 'rule-deploy' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className={logsActionButtonClassName}
                    onClick={onOpenRuleRuntimeLogs}
                  >
                    <span className={logsActionIconWrapClassName}>
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium">Runtime logs</span>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Policy event</span>
                )}
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <TableEmptyRow colSpan={7} icon={<Rocket className="h-5 w-5 text-muted-foreground" />} />
          )}
        </tbody>
      </table>
      {events.length > 0 && (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={events.length}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
        />
      )}
    </div>
  </TabsContent>
);
