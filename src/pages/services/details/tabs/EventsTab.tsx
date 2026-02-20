import { Button } from '@/components/ui/button';
import { TableEmptyRow } from '@/components/layout/EmptyState';
import { TablePagination } from '@/components/layout/TablePagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { TabsContent } from '@/components/ui/tabs';
import type { Deploy, RuleDeploy } from '@/types/releasea';
import { AlertTriangle, FileText, GitBranch, Rocket, Route as RouteIcon } from 'lucide-react';

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
                ) : (
                  <div className="flex items-center gap-1.5">
                    <RouteIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Rule deploy</span>
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
                ) : (
                  <span className="font-mono text-sm">{event.label}</span>
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
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => onOpenDeployLog(event.deploy)}
                  >
                    <FileText className="w-4 h-4" />
                    View logs
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={onOpenRuleRuntimeLogs}
                  >
                    <FileText className="w-4 h-4" />
                    Runtime logs
                  </Button>
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
