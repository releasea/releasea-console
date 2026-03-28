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
    <TabsContent value="summary" className="space-y-6">
    <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 items-stretch">
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Summary</p>
            <h3 className="text-lg font-semibold text-foreground">{serviceTypeLabel}</h3>
            <p className="text-sm text-muted-foreground">
              {service.name} • {runtimeLabel}
            </p>
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
            <Badge
              variant={isServiceActive ? 'secondary' : 'outline'}
              className="text-xs normal-case"
            >
              {isServiceActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className="text-xs normal-case">
              {serviceTypeLabel}
            </Badge>
            <Badge variant={managementMode === 'observed' ? 'secondary' : 'outline'} className="text-xs normal-case">
              {managementMode === 'observed' ? 'Observed' : 'Managed'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Instance</p>
            <p className="font-medium text-foreground">{instanceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Environment</p>
            <p className="font-medium text-foreground">{viewEnvLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Repository</p>
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
              <p className="text-sm text-muted-foreground">Managed by Releasea</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dockerfile</p>
            <p className="font-mono text-sm text-foreground">{dockerfileLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Context</p>
            <p className="font-mono text-sm text-foreground">{dockerContextLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Environment Variables</p>
            <p className="text-sm text-foreground">{envCountLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Health Path</p>
            <p className="font-mono text-sm text-foreground">{healthPath}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60 space-y-2">
          {managementMode === 'observed' && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Observed mode operating rules</p>
              <p>
                This service is currently observed only. Releasea keeps visibility and settings, but operating control
                stays locked until you switch it to managed mode.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {OBSERVED_MODE_RESTRICTIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {deployPolicyPreflightLoading && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Checking deploy policy for {viewEnvLabel}...
            </div>
          )}
          {!deployPolicyPreflightLoading && deployPolicyViolations.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Deploy policy preflight has blockers</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {deployPolicyViolations.map((violation, index) => (
                      <li key={`${violation.code}-${index}`}>{violation.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
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
                    <TooltipContent side="top" className="max-w-xs bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
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
            <div className="flex items-center gap-1.5 text-xs">
              {liveSyncError ? (
                <span className="inline-flex items-center gap-1.5 text-yellow-500">
                  <AlertTriangle className="w-3 h-3" />
                  Live sync delayed
                </span>
              ) : isLive ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  Idle
                </span>
              )}
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
      <div className="rounded-lg border border-border bg-card p-4 space-y-4 lg:col-span-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Release Intelligence</h3>
            <p className="text-sm text-muted-foreground">
              Compares the latest managed release with current telemetry and the immediately previous successful deploy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`text-xs normal-case ${overallSloClasses}`}>
              SLO: {overallSloState === 'unknown' ? 'unknown' : overallSloState}
            </Badge>
            <Badge variant="outline" className={`text-xs normal-case ${rollbackClasses}`}>
              Rollback: {rollbackState.replace('-', ' ')}
            </Badge>
          </div>
        </div>

        {releaseIntelligence ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs">SLO Snapshot</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Availability</p>
                  <p className="text-lg font-semibold text-foreground">
                    {releaseIntelligence.slo.availabilityPct == null ? '--' : `${releaseIntelligence.slo.availabilityPct}%`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Target {releaseIntelligence.slo.availabilityTargetPct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">5xx error rate</p>
                  <p className="text-lg font-semibold text-foreground">
                    {releaseIntelligence.slo.errorRatePct == null ? '--' : `${releaseIntelligence.slo.errorRatePct}%`}
                  </p>
                  <p className="text-xs text-muted-foreground">Current telemetry window</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Latency p95</p>
                  <p className="text-lg font-semibold text-foreground">
                    {releaseIntelligence.slo.latencyP95AvgMs == null ? '--' : `${releaseIntelligence.slo.latencyP95AvgMs} ms`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Target {releaseIntelligence.slo.latencyTargetMs} ms
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                Latest release <span className="font-mono text-foreground">{releaseIntelligence.latestReleaseLabel}</span>
                {releaseIntelligence.previousReleaseLabel ? (
                  <>
                    {' '}is compared with previous successful release{' '}
                    <span className="font-mono text-foreground">{releaseIntelligence.previousReleaseLabel}</span>.
                  </>
                ) : (
                  '. There is no previous successful release available for direct comparison.'
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Deploy Baseline</span>
              </div>
              {releaseIntelligence.baseline.available ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Latency before</p>
                      <p className="font-semibold text-foreground">
                        {releaseIntelligence.baseline.latencyBeforeMs == null ? '--' : `${releaseIntelligence.baseline.latencyBeforeMs} ms`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Latency after</p>
                      <p className="font-semibold text-foreground">
                        {releaseIntelligence.baseline.latencyAfterMs == null ? '--' : `${releaseIntelligence.baseline.latencyAfterMs} ms`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">5xx before</p>
                      <p className="font-semibold text-foreground">
                        {releaseIntelligence.baseline.errorRateBeforePct == null ? '--' : `${releaseIntelligence.baseline.errorRateBeforePct}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">5xx after</p>
                      <p className="font-semibold text-foreground">
                        {releaseIntelligence.baseline.errorRateAfterPct == null ? '--' : `${releaseIntelligence.baseline.errorRateAfterPct}%`}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      Latency change:{' '}
                      <span className="font-medium text-foreground">
                        {releaseIntelligence.baseline.latencyChangePct == null ? '--' : `${releaseIntelligence.baseline.latencyChangePct}%`}
                      </span>
                    </div>
                    <div>
                      5xx change:{' '}
                      <span className="font-medium text-foreground">
                        {releaseIntelligence.baseline.errorRateChangePct == null ? '--' : `${releaseIntelligence.baseline.errorRateChangePct}%`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not enough telemetry exists before and after the latest deploy to compute a baseline yet.
                </p>
              )}
              <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
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
          <Badge variant="outline" className="text-xs font-mono">
            {healthPath}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Path: <span className="font-mono text-foreground">{healthPath}</span>
        </p>
        <p className="text-xs text-muted-foreground">Last probe info unavailable.</p>
      </div>
    </div>
    </TabsContent>
  );
};
