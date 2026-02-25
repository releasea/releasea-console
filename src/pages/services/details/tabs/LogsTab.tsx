import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import type { LogEntry } from '@/types/releasea';
import { FileText } from 'lucide-react';
import { LOG_LINE_LIMIT } from '../constants';
import { redactSensitiveText } from '@/platform/security/data-security';

type LogsTabProps = {
  selectedReplica: string;
  onSelectReplica: (value: string) => void;
  selectedContainer: string;
  onSelectContainer: (value: string) => void;
  logsLoaded: boolean;
  logsLoading: boolean;
  podsLoading: boolean;
  containersLoading: boolean;
  replicaOptions: string[];
  containerOptions: string[];
  selectedContainerIsHistorical: boolean;
  onLoadLogs: () => void;
  visibleLogs: LogEntry[];
  viewEnvLabel: string;
};

export const LogsTab = ({
  selectedReplica,
  onSelectReplica,
  selectedContainer,
  onSelectContainer,
  logsLoaded,
  logsLoading,
  podsLoading,
  containersLoading,
  replicaOptions,
  containerOptions,
  selectedContainerIsHistorical,
  onLoadLogs,
  visibleLogs,
  viewEnvLabel,
}: LogsTabProps) => (
  <TabsContent value="logs" className="space-y-4">
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Service logs</h3>
          <p className="text-xs text-muted-foreground">
            Logs are loaded on demand to protect platform performance.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="w-full lg:w-44">
            <Select
              value={selectedReplica}
              onValueChange={onSelectReplica}
            >
              <SelectTrigger className="w-full bg-muted/50">
                <SelectValue
                  placeholder={
                    podsLoading
                      ? 'Loading instances...'
                      : replicaOptions.length === 0
                        ? 'No instances found'
                        : 'Select pod instance'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__pod_default__" disabled>
                  Pod instance
                </SelectItem>
                {replicaOptions.map((podName) => (
                  <SelectItem key={podName} value={podName}>
                    {podName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full lg:w-52">
            <Select
              value={selectedContainer}
              onValueChange={onSelectContainer}
              disabled={!selectedReplica}
            >
              <SelectTrigger className="w-full bg-muted/50">
                <SelectValue
                  placeholder={
                    !selectedReplica
                      ? 'Select pod instance first'
                      : containersLoading
                        ? 'Loading containers...'
                        : containerOptions.length === 0
                          ? 'No containers found'
                          : 'Select container'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__container_default__" disabled>
                  Container
                </SelectItem>
                {selectedContainerIsHistorical && selectedContainer ? (
                  <SelectItem value={selectedContainer}>{selectedContainer} (historical)</SelectItem>
                ) : null}
                {containerOptions.map((containerName) => (
                  <SelectItem key={containerName} value={containerName}>
                    {containerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={onLoadLogs}
            disabled={logsLoading || !selectedReplica}
          >
            <FileText className="w-4 h-4" />
            {logsLoading ? 'Loading…' : logsLoaded ? 'Reload logs' : 'Load logs'}
          </Button>
        </div>
      </div>

      {selectedContainerIsHistorical && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Selected container is no longer active. Showing the latest {LOG_LINE_LIMIT} retained lines for it.
        </div>
      )}

    </div>

    <div className="terminal-bg p-4 max-h-[500px] overflow-auto">
      <div className="space-y-1 font-mono text-[13px] leading-5">
        {!logsLoaded && (
          <p className="text-muted-foreground">
            Click "Load logs" to fetch recent entries for a specific pod and container.
          </p>
        )}
        {logsLoaded && visibleLogs.length === 0 && (
          <div className="text-muted-foreground space-y-1">
            <p>No logs found for the selected instance in environment {viewEnvLabel}.</p>
            <p className="text-xs">
              This may indicate that Loki is not collecting logs for this namespace, or the service has no running pods.
            </p>
          </div>
        )}
        {logsLoaded &&
          visibleLogs.length > 0 &&
          visibleLogs.map((log) => (
            <div key={log.id}>
              <span className="text-foreground">
                {redactSensitiveText(log.message, {
                  maskEmails: true,
                  maskIPs: true,
                  maxLength: 2000,
                })}
              </span>
            </div>
          ))}
      </div>
    </div>

    <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
      Containers are listed from the last 3 hours of runtime logs. Showing the last {LOG_LINE_LIMIT} lines for performance. Narrow filters to reduce load.
    </div>
  </TabsContent>
);
