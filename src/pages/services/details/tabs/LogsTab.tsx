import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Download, FileText, RefreshCw, Search, Server, WrapText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import type { LogEntry } from '@/types/releasea';
import { redactSensitiveText } from '@/platform/security/data-security';
import { LOG_LINE_LIMIT } from '../constants';
import { ServiceTabHeader } from '../ServiceTabHeader';

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
  namespace?: string;
  podDiscoveryError?: string | null;
  logsError?: string | null;
  lastLoadedAt?: Date | null;
};

const readLogLevel = (log: LogEntry) => {
  const metadataLevel = typeof log.metadata?.level === 'string' ? log.metadata.level : '';
  const match = log.message.match(/\b(trace|debug|info|warn|warning|error|fatal)\b/i);
  return (log.level || metadataLevel || match?.[1] || 'info').toLowerCase();
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
  namespace,
  podDiscoveryError,
  logsError,
  lastLoadedAt,
}: LogsTabProps) => {
  const [query, setQuery] = useState('');
  const [wrapLines, setWrapLines] = useState(true);
  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return visibleLogs;
    return visibleLogs.filter((log) => log.message.toLowerCase().includes(normalized));
  }, [query, visibleLogs]);

  const downloadLogs = () => {
    if (filteredLogs.length === 0) return;
    const contents = filteredLogs
      .map((log) => `${log.timestamp ?? ''} ${readLogLevel(log).toUpperCase()} ${log.message}`.trim())
      .join('\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedReplica || 'service'}-${selectedContainer || 'all'}-logs.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TabsContent value="logs" className="space-y-4">
      <ServiceTabHeader
        title="Runtime logs"
        description="Inspect real container output collected by Loki for a specific running instance."
        environment={viewEnvLabel}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setWrapLines((value) => !value)}>
              <WrapText className="h-4 w-4" />
              {wrapLines ? 'Disable wrap' : 'Wrap lines'}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" disabled={filteredLogs.length === 0} onClick={downloadLogs}>
              <Download className="h-4 w-4" />
              Download
            </Button>
          </>
        }
      />

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]">
          <Select value={selectedReplica} onValueChange={onSelectReplica}>
            <SelectTrigger className="w-full bg-muted/30" aria-label="Pod instance">
              <SelectValue placeholder={podsLoading ? 'Discovering instances…' : replicaOptions.length === 0 ? 'No running instances' : 'Select instance'} />
            </SelectTrigger>
            <SelectContent>
              {replicaOptions.map((podName) => <SelectItem key={podName} value={podName}>{podName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedContainer} onValueChange={onSelectContainer} disabled={!selectedReplica}>
            <SelectTrigger className="w-full bg-muted/30" aria-label="Container">
              <SelectValue placeholder={!selectedReplica ? 'Select an instance first' : containersLoading ? 'Discovering containers…' : containerOptions.length === 0 ? 'All containers' : 'Select container'} />
            </SelectTrigger>
            <SelectContent>
              {selectedContainerIsHistorical && selectedContainer ? <SelectItem value={selectedContainer}>{selectedContainer} (retained)</SelectItem> : null}
              {containerOptions.map((containerName) => <SelectItem key={containerName} value={containerName}>{containerName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={onLoadLogs} disabled={logsLoading || !selectedReplica}>
            {logsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {logsLoading ? 'Loading logs…' : logsLoaded ? 'Refresh logs' : 'Load logs'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Server className="h-3.5 w-3.5" />{namespace || 'Namespace unavailable'}</span>
          <span>Window: last 3 hours</span>
          <span>Limit: {LOG_LINE_LIMIT} lines</span>
          {lastLoadedAt ? <span>Updated {format(lastLoadedAt, 'HH:mm:ss')}</span> : null}
        </div>
      </div>

      {podDiscoveryError || logsError ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Log collection is unavailable</p>
            <p className="mt-1 text-muted-foreground">{logsError || podDiscoveryError}</p>
          </div>
        </div>
      ) : null}

      {!podsLoading && replicaOptions.length === 0 && !podDiscoveryError ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <Server className="mx-auto h-8 w-8 text-muted-foreground" />
          <h4 className="mt-3 text-sm font-semibold text-foreground">No running instances in {viewEnvLabel}</h4>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Deploy the service in this environment first. Instances will appear here as soon as Loki receives their logs.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-[hsl(var(--terminal))] shadow-sm">
          <div className="flex flex-col gap-2 border-b border-white/10 bg-black/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter loaded logs" className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-white/40" />
            </div>
            <span className="text-xs text-white/50">{filteredLogs.length} of {visibleLogs.length} lines</span>
          </div>
          <div className="max-h-[560px] min-h-[260px] overflow-auto p-4 font-mono text-xs leading-5">
            {!logsLoaded ? <p className="text-white/50">Select an instance and load logs to begin troubleshooting.</p> : null}
            {logsLoaded && filteredLogs.length === 0 ? <p className="text-white/50">{query ? 'No loaded lines match this filter.' : 'No log lines were returned for this selection.'}</p> : null}
            {filteredLogs.map((log) => {
              const level = readLogLevel(log);
              return (
                <div key={log.id} className={`grid grid-cols-[74px_54px_minmax(0,1fr)] gap-2 border-b border-white/5 py-0.5 ${wrapLines ? '' : 'min-w-max'}`}>
                  <span className="text-white/40">{log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : '--:--:--'}</span>
                  <span className={level === 'error' || level === 'fatal' ? 'text-red-300' : level.startsWith('warn') ? 'text-amber-300' : 'text-cyan-300'}>{level.toUpperCase()}</span>
                  <span className={`text-white/90 ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>{redactSensitiveText(log.message, { maskEmails: true, maskIPs: true, maxLength: 2000 })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedContainerIsHistorical ? <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">This container is no longer active. The query uses the extended retained-log window.</div> : null}
    </TabsContent>
  );
};
