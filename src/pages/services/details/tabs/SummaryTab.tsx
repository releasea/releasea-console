import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import type { DeployStatusValue, Service, ServiceStatus } from '@/types/releasea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, Cpu, ExternalLink, HardDrive, ListOrdered, Loader2, Rocket, Timer, TrendingUp } from 'lucide-react';
import { sanitizeExternalURL } from '@/platform/security/data-security';

type AppUrl = {
  id: string;
  href: string | null;
  display: string;
  protocolLabel: string;
  targetLabel: string;
};

type SummaryTabProps = {
  service: Service;
  serviceTypeLabel: string;
  runtimeLabel: string;
  liveUpdatesEnabled: boolean;
  instanceLabel: string;
  runningInstancesLabel: string;
  deployedEnvironmentsLabel: string;
  latestVersionLabel: string;
  viewEnvLabel: string;
  /** General status shown to users (runtime + active deploy phase). */
  displayStatus: ServiceStatus | DeployStatusValue;
  /** Strategy phase summary (e.g. "Deploying", "Validating") when deploy is in progress. */
  latestDeployStrategySummary?: string;
  repositoryUrl: string | null;
  dockerImageLabel: string | null;
  branchName: string;
  dockerfileLabel: string;
  dockerContextLabel: string;
  envCountLabel: string;
  healthPath: string;
  healthStatusLabel: string;
  healthUpdatedLabel: string;
  appUrls: AppUrl[];
  deployBusy: boolean;
  deployDisabled: boolean;
  deployRestrictionMessage?: string;
  onDeployLatest: () => void;
  onOpenVersionPicker: () => void;
  isCanaryStrategy?: boolean;
  canaryPercent?: number;
  /** True when the latest deploy in this env completed successfully (canary has a version to promote). */
  canPromoteCanary?: boolean;
  onPromoteCanary?: () => void;
  promoteCanaryInProgress?: boolean;
  cpuAvgLabel: string;
  cpuPeakLabel: string;
  memoryAvgLabel: string;
  memoryPeakLabel: string;
  latencyAvgLabel: string;
  latencyPeakLabel: string;
  requestsAvgLabel: string;
  requestsPeakLabel: string;
  onToggleLiveUpdates: (enabled: boolean) => void;
};

export const SummaryTab = ({
  service,
  serviceTypeLabel,
  runtimeLabel,
  liveUpdatesEnabled,
  instanceLabel,
  runningInstancesLabel,
  deployedEnvironmentsLabel,
  latestVersionLabel,
  viewEnvLabel,
  displayStatus,
  latestDeployStrategySummary,
  repositoryUrl,
  dockerImageLabel,
  branchName,
  dockerfileLabel,
  dockerContextLabel,
  envCountLabel,
  healthPath,
  healthStatusLabel,
  healthUpdatedLabel,
  appUrls,
  deployBusy,
  deployDisabled,
  deployRestrictionMessage,
  onDeployLatest,
  onOpenVersionPicker,
  isCanaryStrategy,
  canaryPercent = 0,
  canPromoteCanary = false,
  onPromoteCanary,
  promoteCanaryInProgress,
  cpuAvgLabel,
  cpuPeakLabel,
  memoryAvgLabel,
  memoryPeakLabel,
  latencyAvgLabel,
  latencyPeakLabel,
  requestsAvgLabel,
  requestsPeakLabel,
  onToggleLiveUpdates,
}: SummaryTabProps) => {
  const safeRepositoryURL = repositoryUrl ? sanitizeExternalURL(repositoryUrl) : null;

  return (
    <TabsContent value="summary" className="space-y-6">
    <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 items-stretch">
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Summary</p>
            <h3 className="text-lg font-semibold text-foreground">Service overview</h3>
            <p className="text-sm text-muted-foreground">Runtime, source, and deploy controls for the current service.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={displayStatus}
              className="normal-case"
            />
            {latestDeployStrategySummary && (
              <span className="text-xs text-muted-foreground">
                {latestDeployStrategySummary}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Runtime profile</p>
            <p className="font-medium text-foreground">{instanceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Instances · {viewEnvLabel}</p>
            <p className="font-medium text-foreground">{runningInstancesLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Application repository</p>
            {safeRepositoryURL?.href ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={safeRepositoryURL.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  {safeRepositoryURL.display}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <Badge variant="secondary" className="text-xs font-mono">
                  {branchName}
                </Badge>
              </div>
            ) : safeRepositoryURL?.display ? (
              <p className="text-sm font-mono text-muted-foreground">{safeRepositoryURL.display}</p>
            ) : dockerImageLabel ? (
              <p className="text-sm font-mono text-foreground">{dockerImageLabel}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Application repository not configured</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deployed environments</p>
            <p className="text-sm text-foreground">{deployedEnvironmentsLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latest version · {viewEnvLabel}</p>
            <p className="font-mono text-sm text-foreground">{latestVersionLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Build source</p>
            <p className="font-mono text-sm text-foreground">{dockerfileLabel} · {dockerContextLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Environment variables</p>
            <p className="text-sm text-foreground">{envCountLabel}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {deployDisabled && deployRestrictionMessage ? (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed">
                        <Button size="sm" className="gap-2 pointer-events-none" disabled aria-busy={deployBusy}>
                          {deployBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Rocket className="w-4 h-4" />
                          )}
                          {deployBusy ? `Deploying to ${viewEnvLabel}` : `Deploy to ${viewEnvLabel}`}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs border-warning/40 bg-warning/10 text-warning">
                      {deployRestrictionMessage}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-2" disabled={deployDisabled} aria-busy={deployBusy}>
                      {deployBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Rocket className="w-4 h-4" />
                      )}
                      {deployBusy ? `Deploying to ${viewEnvLabel}` : `Deploy to ${viewEnvLabel}`}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem onClick={onDeployLatest}>
                      <Rocket className="w-4 h-4 mr-2" />
                      Deploy latest version
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenVersionPicker}>
                      <ListOrdered className="w-4 h-4 mr-2" />
                      Deploy specific version
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Versions are loaded from deployment history.
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {isCanaryStrategy && onPromoteCanary && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={onPromoteCanary}
                  disabled={!canPromoteCanary || promoteCanaryInProgress || deployDisabled}
                  aria-busy={promoteCanaryInProgress}
                  title={!canPromoteCanary ? 'Complete a canary deploy successfully to enable promote' : undefined}
                >
                  {promoteCanaryInProgress ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {promoteCanaryInProgress ? 'Promoting...' : 'Promote to 100%'}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="text-right">
                <p className="text-xs font-medium text-foreground">Live updates</p>
                <p className="text-[11px] text-muted-foreground">
                  {liveUpdatesEnabled ? `Auto-refreshing ${viewEnvLabel}` : 'Automatic refresh paused'}
                </p>
              </div>
              <Switch
                checked={liveUpdatesEnabled}
                onCheckedChange={onToggleLiveUpdates}
                aria-label={`${liveUpdatesEnabled ? 'Pause' : 'Resume'} live updates`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-full flex-col gap-4">
        {service.type === 'static-site' ? (
          <>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Rocket className="w-4 h-4" />
                <span className="text-xs">Requests/min (avg)</span>
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">{requestsAvgLabel}</div>
              <p className="text-xs text-muted-foreground mt-1">Peak {requestsPeakLabel}</p>
            </div>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span className="text-xs">Latency p95 (avg)</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-foreground">{latencyAvgLabel}</div>
            <p className="text-xs text-muted-foreground mt-1">Peak {latencyPeakLabel}</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="w-4 h-4" />
                <span className="text-xs">CPU (1h avg)</span>
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">{cpuAvgLabel}</div>
              <p className="text-xs text-muted-foreground mt-1">Peak {cpuPeakLabel}</p>
            </div>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HardDrive className="w-4 h-4" />
                <span className="text-xs">RAM (used)</span>
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">{memoryAvgLabel}</div>
              <p className="text-xs text-muted-foreground mt-1">Peak {memoryPeakLabel}</p>
            </div>
            <div className="flex flex-1 flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span className="text-xs">Latency p95</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-foreground">{latencyAvgLabel}</div>
            <p className="text-xs text-muted-foreground mt-1">Avg last hour</p>
            </div>
          </>
        )}
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">App URL</h3>
        </div>
        {appUrls.length > 0 ? (
          <div className="flex flex-col gap-2">
            {appUrls.map((url) => (
              <div key={url.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs font-mono">
                  {url.protocolLabel}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {url.targetLabel}
                </Badge>
                {url.href ? (
                  <a
                    href={url.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {url.display}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">{url.display}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No published URLs for this environment.</p>
        )}
        <p className="text-xs text-muted-foreground">
          URLs are available based on published rules and gateways.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Health Checks</h3>
          <Badge variant={healthStatusLabel === 'Healthy' ? 'secondary' : 'outline'} className="text-xs normal-case">
            {healthStatusLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Path: <span className="font-mono text-foreground">{healthPath}</span>
        </p>
        <p className="text-xs text-muted-foreground">{healthUpdatedLabel}</p>
      </div>
    </div>
    </TabsContent>
  );
};
