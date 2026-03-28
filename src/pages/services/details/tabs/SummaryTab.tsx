import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { TabsContent } from '@/components/ui/tabs';
import type { DeployStatusValue, Service, ServiceStatus } from '@/types/releasea';
import type { DeployPolicyPreflight } from '@/types/governance';
import type { ReleaseIntelligenceSummary } from '@/lib/release-intelligence';
import { OBSERVED_MODE_RESTRICTIONS } from '@/lib/management-mode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, ChevronDown, Cpu, ExternalLink, HardDrive, ListOrdered, Loader2, Rocket, ShieldCheck, Timer, TrendingUp } from 'lucide-react';
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
  isServiceActive: boolean;
  instanceLabel: string;
  viewEnvLabel: string;
  displayStatus: ServiceStatus | DeployStatusValue;
  latestDeployStrategySummary?: string;
  repositoryUrl: string | null;
  dockerImageLabel: string | null;
  branchName: string;
  dockerfileLabel: string;
  dockerContextLabel: string;
  envCountLabel: string;
  healthPath: string;
  appUrls: AppUrl[];
  deployPolicyPreflight: DeployPolicyPreflight | null;
  deployPolicyPreflightLoading: boolean;
  deployBusy: boolean;
  deployDisabled: boolean;
  deployRestrictionMessage?: string;
  onDeployLatest: () => void;
  onOpenVersionPicker: () => void;
  isCanaryStrategy?: boolean;
  canaryPercent?: number;
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
  releaseIntelligence: ReleaseIntelligenceSummary | null;
  isLive?: boolean;
  liveSyncError?: string | null;
};

export const SummaryTab = ({
  service,
  serviceTypeLabel,
  runtimeLabel,
  isServiceActive,
  instanceLabel,
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
  appUrls,
  deployPolicyPreflight,
  deployPolicyPreflightLoading,
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
  releaseIntelligence,
  isLive,
  liveSyncError,
}: SummaryTabProps) => {
  const safeRepositoryURL = repositoryUrl ? sanitizeExternalURL(repositoryUrl) : null;
  const managementMode = service.managementMode ?? 'managed';
  const deployPolicyViolations = deployPolicyPreflight?.violations ?? [];
  const overallSloState = releaseIntelligence?.slo.overallState ?? 'unknown';
  const rollbackState = releaseIntelligence?.rollback.recommendation ?? 'insufficient-data';
  const overallSloClasses =
    overallSloState === 'meeting'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : overallSloState === 'at-risk'
        ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
        : overallSloState === 'breached'
          ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
          : 'border-border/60 text-muted-foreground';
  const rollbackClasses =
    rollbackState === 'stable'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : rollbackState === 'watch'
        ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
        : rollbackState === 'rollback'
          ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
          : 'border-border/60 text-muted-foreground';

  return (
    <TabsContent value="summary" className="space-y-5">
      {/* Deploy Action Strip */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={displayStatus} className="normal-case" />
            {latestDeployStrategySummary && (
              <span className="text-xs text-muted-foreground">{latestDeployStrategySummary}</span>
            )}
            <Badge variant={isServiceActive ? 'secondary' : 'outline'} className="text-[10px] normal-case h-5">
              {isServiceActive ? 'Active' : 'Inactive'}
            </Badge>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">{instanceLabel}</span>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">{viewEnvLabel}</span>
            {/* Live indicator */}
            <span className="text-xs text-muted-foreground/40">·</span>
            {liveSyncError ? (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-500">
                <AlertTriangle className="w-3 h-3" />
                Sync delayed
              </span>
            ) : isLive ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                Idle
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {deployDisabled && deployRestrictionMessage ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <Button size="sm" className="gap-2 pointer-events-none" disabled aria-busy={deployBusy}>
                        {deployBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                        {deployBusy ? `Deploying...` : `Deploy to ${viewEnvLabel}`}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
                    {deployRestrictionMessage}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-2" disabled={deployDisabled} aria-busy={deployBusy}>
                    {deployBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {deployBusy ? `Deploying...` : `Deploy to ${viewEnvLabel}`}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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
                {promoteCanaryInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {promoteCanaryInProgress ? 'Promoting...' : 'Promote 100%'}
              </Button>
            )}
          </div>
        </div>

        {/* Policy warnings inline */}
        {deployPolicyPreflightLoading && (
          <div className="mt-2 text-xs text-muted-foreground">Checking deploy policy for {viewEnvLabel}...</div>
        )}
        {!deployPolicyPreflightLoading && deployPolicyViolations.length > 0 && (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">Deploy policy has blockers</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {deployPolicyViolations.map((violation, index) => (
                    <li key={`${violation.code}-${index}`}>{violation.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        {managementMode === 'observed' && (
          <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Observed mode</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {OBSERVED_MODE_RESTRICTIONS.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Metrics + Service Info Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-5">
        {/* Service Info */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Service Configuration</h3>
              <span className="text-xs text-muted-foreground">{runtimeLabel}</span>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Repository</p>
              {safeRepositoryURL?.href ? (
                <a
                  href={safeRepositoryURL.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  {safeRepositoryURL.display}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : dockerImageLabel ? (
                <p className="text-xs font-mono text-foreground mt-0.5 truncate">{dockerImageLabel}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Managed</p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Branch</p>
              <p className="font-mono text-xs text-foreground mt-0.5">{branchName}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Dockerfile</p>
              <p className="font-mono text-xs text-foreground mt-0.5">{dockerfileLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Context</p>
              <p className="font-mono text-xs text-foreground mt-0.5">{dockerContextLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Env Vars</p>
              <p className="text-xs text-foreground mt-0.5">{envCountLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Health</p>
              <p className="font-mono text-xs text-foreground mt-0.5">{healthPath}</p>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-1 gap-3 xl:w-56">
          {service.type === 'static-site' ? (
            <>
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Rocket className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">Requests/min</span>
                </div>
                <div className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">{requestsAvgLabel}</div>
                <p className="text-[11px] text-muted-foreground">Peak {requestsPeakLabel}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">Latency p95</span>
                </div>
                <div className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">{latencyAvgLabel}</div>
                <p className="text-[11px] text-muted-foreground">Peak {latencyPeakLabel}</p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Cpu className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">CPU</span>
                </div>
                <div className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">{cpuAvgLabel}</div>
                <p className="text-[11px] text-muted-foreground">Peak {cpuPeakLabel}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">RAM</span>
                </div>
                <div className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">{memoryAvgLabel}</div>
                <p className="text-[11px] text-muted-foreground">Peak {memoryPeakLabel}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3.5 col-span-2 xl:col-span-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">Latency p95</span>
                </div>
                <div className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">{latencyAvgLabel}</div>
                <p className="text-[11px] text-muted-foreground">Avg last hour</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Release Intelligence */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Release Intelligence</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compares latest release with current telemetry and previous successful deploy.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`text-[10px] normal-case h-5 ${overallSloClasses}`}>
              SLO: {overallSloState === 'unknown' ? 'unknown' : overallSloState}
            </Badge>
            <Badge variant="outline" className={`text-[10px] normal-case h-5 ${rollbackClasses}`}>
              Rollback: {rollbackState.replace('-', ' ')}
            </Badge>
          </div>
        </div>
        <div className="p-4">
          {releaseIntelligence ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-medium">SLO Snapshot</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Availability</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">
                      {releaseIntelligence.slo.availabilityPct == null ? '--' : `${releaseIntelligence.slo.availabilityPct}%`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Target {releaseIntelligence.slo.availabilityTargetPct}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">5xx rate</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">
                      {releaseIntelligence.slo.errorRatePct == null ? '--' : `${releaseIntelligence.slo.errorRatePct}%`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Current window</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Latency p95</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">
                      {releaseIntelligence.slo.latencyP95AvgMs == null ? '--' : `${releaseIntelligence.slo.latencyP95AvgMs} ms`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Target {releaseIntelligence.slo.latencyTargetMs} ms</p>
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                  Release <span className="font-mono text-foreground">{releaseIntelligence.latestReleaseLabel}</span>
                  {releaseIntelligence.previousReleaseLabel ? (
                    <> vs <span className="font-mono text-foreground">{releaseIntelligence.previousReleaseLabel}</span></>
                  ) : (
                    '. No previous release for comparison.'
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Deploy Baseline</span>
                </div>
                {releaseIntelligence.baseline.available ? (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Latency before</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          {releaseIntelligence.baseline.latencyBeforeMs == null ? '--' : `${releaseIntelligence.baseline.latencyBeforeMs} ms`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Latency after</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          {releaseIntelligence.baseline.latencyAfterMs == null ? '--' : `${releaseIntelligence.baseline.latencyAfterMs} ms`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">5xx before</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          {releaseIntelligence.baseline.errorRateBeforePct == null ? '--' : `${releaseIntelligence.baseline.errorRateBeforePct}%`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">5xx after</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          {releaseIntelligence.baseline.errorRateAfterPct == null ? '--' : `${releaseIntelligence.baseline.errorRateAfterPct}%`}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                      <div>
                        Latency change:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                          {releaseIntelligence.baseline.latencyChangePct == null ? '--' : `${releaseIntelligence.baseline.latencyChangePct}%`}
                        </span>
                      </div>
                      <div>
                        5xx change:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                          {releaseIntelligence.baseline.errorRateChangePct == null ? '--' : `${releaseIntelligence.baseline.errorRateChangePct}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not enough telemetry to compute a baseline yet.
                  </p>
                )}
                <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                  {releaseIntelligence.rollback.message}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Release intelligence needs at least one successful deploy and a metrics window with telemetry.
            </p>
          )}
        </div>
      </div>

      {/* App URL + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground">App URLs</h3>
          </div>
          <div className="p-4 space-y-2">
            {appUrls.length > 0 ? (
              <div className="flex flex-col gap-2">
                {appUrls.map((url) => (
                  <div key={url.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono h-5">
                      {url.protocolLabel}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {url.targetLabel}
                    </Badge>
                    {url.href ? (
                      <a
                        href={url.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {url.display}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{url.display}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No published URLs for this environment.</p>
            )}
            <p className="text-[11px] text-muted-foreground pt-1">
              URLs are available based on published rules and gateways.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Health Checks</h3>
            <Badge variant="outline" className="text-[10px] font-mono h-5">{healthPath}</Badge>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Path: <span className="font-mono text-foreground">{healthPath}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Last probe info unavailable.</p>
          </div>
        </div>
      </div>
    </TabsContent>
  );
};
