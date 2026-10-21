import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import type { DeployStatusValue, Service, ServiceStatus } from '@/types/releasea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRightLeft, ChevronDown, Cpu, ExternalLink, HardDrive, ListOrdered, Loader2, Rocket, Timer, TrendingUp } from 'lucide-react';
import { sanitizeExternalURL } from '@/platform/security/data-security';

type EnvironmentUrl = {
  id: string;
  href: string | null;
  display: string;
  zoneLabel: string;
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
  healthReasonLabel?: string;
  healthUpdatedLabel: string;
  environmentUrls: EnvironmentUrl[];
  deployBusy: boolean;
  deployDisabled: boolean;
  deployRestrictionMessage?: string;
  onDeployLatest: () => void;
  onOpenVersionPicker: () => void;
  promotableRelease?: { environmentLabel: string; versionLabel: string } | null;
  onPromoteRelease?: () => void;
  isCanaryStrategy?: boolean;
  isBlueGreenStrategy?: boolean;
  blueGreenTargetLabel?: string;
  canaryPercent?: number;
  /** True when this environment has a finished deploy that can be promoted or switched. */
  canPromote?: boolean;
  onPromote?: () => void;
  onSwitch?: () => void;
  promoteInProgress?: boolean;
  promoteStep?: string;
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
  healthReasonLabel,
  healthUpdatedLabel,
  environmentUrls,
  deployBusy,
  deployDisabled,
  deployRestrictionMessage,
  onDeployLatest,
  onOpenVersionPicker,
  promotableRelease,
  onPromoteRelease,
  isCanaryStrategy,
  isBlueGreenStrategy,
  blueGreenTargetLabel,
  canaryPercent,
  canPromote = false,
  onPromote,
  onSwitch,
  promoteInProgress,
  promoteStep,
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
  const showPromote = Boolean(
    canPromote && ((isCanaryStrategy && onPromote) || (isBlueGreenStrategy && onSwitch)),
  );
  const promoteBusy = Boolean(promoteInProgress);
  const actionsLocked = promoteBusy;
  const canarySteps = [
    { id: 'queued', label: 'Queued' },
    { id: 'prepare', label: 'Prepare stable' },
    { id: 'ready', label: 'Wait for pods' },
    { id: 'shift', label: 'Shift traffic' },
    { id: 'cleanup', label: 'Remove canary' },
    { id: 'finalize', label: 'Finish previous' },
  ];
  const activeCanaryStep = Math.max(0, canarySteps.findIndex((step) => step.id === promoteStep));

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

        <div className="pt-3 border-t border-border/60 space-y-3">
          {isBlueGreenStrategy && showPromote && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">Blue/green switch</p>
              <p className="text-xs text-muted-foreground">
                {promoteBusy
                  ? (latestDeployStrategySummary || `Moving traffic to ${blueGreenTargetLabel}. The address stays published.`)
                  : `${blueGreenTargetLabel} is ready. Traffic stays where it is until you switch.`}
              </p>
            </div>
          )}
          {isCanaryStrategy && showPromote && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Canary rollout</p>
                  <p className="text-xs text-muted-foreground">
                    {promoteBusy
                      ? (latestDeployStrategySummary || 'Moving the canary version onto stable. The app URL stays published.')
                      : `${canaryPercent ?? 0}% of traffic is on the canary. Promote moves that version to 100% and keeps the URL published.`}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {promoteBusy ? 'In progress' : `${canaryPercent ?? 0}% canary`}
                </Badge>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-muted-foreground/30" style={{ width: `${Math.max(0, 100 - (canaryPercent ?? 0))}%` }} />
                <div className={`bg-primary ${promoteBusy ? 'animate-pulse' : ''}`} style={{ width: `${canaryPercent ?? 0}%` }} />
              </div>
              {promoteBusy && (
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  {canarySteps.map((step, index) => {
                    const done = index < activeCanaryStep;
                    const current = index === activeCanaryStep;
                    return (
                      <li key={step.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {current ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                        ) : (
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? 'bg-success' : 'bg-border'}`} />
                        )}
                        <span className={current ? 'font-medium text-foreground' : undefined}>{step.label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {deployDisabled && deployRestrictionMessage ? (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed">
                        <Button size="sm" className="gap-2 pointer-events-none" disabled aria-busy={deployBusy || actionsLocked}>
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
                    <Button size="sm" className="gap-2" disabled={deployDisabled || actionsLocked} aria-busy={deployBusy || actionsLocked} title={actionsLocked ? 'Wait until the canary promotion finishes.' : undefined}>
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
                    <DropdownMenuItem onClick={onDeployLatest} disabled={actionsLocked}>
                      <Rocket className="w-4 h-4 mr-2" />
                      Deploy latest version
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenVersionPicker} disabled={actionsLocked}>
                      <ListOrdered className="w-4 h-4 mr-2" />
                      Deploy specific version
                    </DropdownMenuItem>
                    {promotableRelease && onPromoteRelease && (
                      <DropdownMenuItem onClick={onPromoteRelease} disabled={actionsLocked}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Promote {promotableRelease.versionLabel} from {promotableRelease.environmentLabel}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {promotableRelease
                        ? `Promote reuses the image built in ${promotableRelease.environmentLabel}. A new deploy builds again.`
                        : 'Versions are loaded from deployment history.'}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {showPromote && isBlueGreenStrategy ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={onSwitch}
                  disabled={promoteBusy || deployBusy || !onSwitch}
                  aria-busy={promoteBusy}
                >
                  {promoteBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                  )}
                  {promoteBusy ? `Switching to ${blueGreenTargetLabel}` : `Switch to ${blueGreenTargetLabel}`}
                </Button>
              ) : showPromote ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={onPromote}
                  disabled={promoteBusy || deployBusy || !onPromote}
                  aria-busy={promoteBusy}
                >
                  {promoteBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {promoteBusy ? 'Promoting canary' : 'Promote canary'}
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-3 px-1 py-1">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:col-span-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">App URL</h3>
          <span className="text-xs text-muted-foreground">{viewEnvLabel}</span>
        </div>
        {environmentUrls.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No address is published in {viewEnvLabel}.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-md border border-border/70">
            {environmentUrls.map((url) => (
              <li key={url.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                {url.href ? (
                  <a
                    href={url.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate font-mono text-sm text-primary hover:underline"
                  >
                    {url.display}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{url.display}</span>
                )}
                <span className="shrink-0 text-[11px] text-muted-foreground">{url.zoneLabel}</span>
                {url.href ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
              </li>
            ))}
          </ul>
        )}
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
        {healthReasonLabel ? <p className="text-sm text-foreground">{healthReasonLabel}</p> : null}
        <p className="text-xs text-muted-foreground">{healthUpdatedLabel}</p>
      </div>
    </div>
    </div>
    </TabsContent>
  );
};
