import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import type { DeployPolicyPreflight } from '@/types/governance';
import type { ReleaseIntelligenceSummary } from '@/lib/release-intelligence';
import { OBSERVED_MODE_RESTRICTIONS } from '@/lib/management-mode';
import type { ManagementTransitionRequirement } from '@/pages/services/details/ManagementModeTransitionDialog';
import type {
  Service,
  ServiceDesiredStateValidation,
  ServiceGitOpsDriftStatus,
  ServiceGitOpsLayoutPreset,
  ServiceGitOpsRepositoryPolicyCheck,
  ServiceGitOpsTimelineEvent,
} from '@/types/releasea';
import { buildServiceReadinessScorecard } from '@/lib/service-readiness';
import { cn } from '@/lib/utils';
import { AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';

type DeliveryTabProps = {
  service: Service;
  viewEnvLabel: string;
  managementTransitionRequirements: ManagementTransitionRequirement[];
  deployPolicyPreflight: DeployPolicyPreflight | null;
  deployPolicyPreflightLoading: boolean;
  gitOpsRepositoryPolicyCheck: ServiceGitOpsRepositoryPolicyCheck | null;
  gitOpsRepositoryPolicyCheckLoading: boolean;
  gitOpsDrift: ServiceGitOpsDriftStatus | null;
  gitOpsDriftLoading: boolean;
  gitOpsLayoutPresets?: ServiceGitOpsLayoutPreset[];
  gitOpsLayoutPresetsLoading?: boolean;
  gitOpsTimeline?: ServiceGitOpsTimelineEvent[];
  gitOpsTimelineLoading: boolean;
  desiredStateValidation: ServiceDesiredStateValidation | null;
  desiredStateValidationLoading: boolean;
  releaseIntelligence: ReleaseIntelligenceSummary | null;
};

export const DeliveryTab = ({
  service,
  viewEnvLabel,
  managementTransitionRequirements,
  deployPolicyPreflight,
  deployPolicyPreflightLoading,
  gitOpsRepositoryPolicyCheck,
  gitOpsRepositoryPolicyCheckLoading,
  gitOpsDrift,
  gitOpsDriftLoading,
  gitOpsLayoutPresets = [],
  gitOpsLayoutPresetsLoading = false,
  gitOpsTimeline = [],
  gitOpsTimelineLoading = false,
  desiredStateValidation,
  desiredStateValidationLoading,
  releaseIntelligence,
}: DeliveryTabProps) => {
  const deployPolicyViolations = deployPolicyPreflight?.violations ?? [];
  const deployPolicyExceptionsApplied = deployPolicyPreflight?.exceptionsApplied ?? [];
  const deployPolicyDryRun = deployPolicyPreflight?.dryRun === true;
  const managementMode = service.managementMode ?? 'managed';
  const readinessScorecard = buildServiceReadinessScorecard({
    service,
    requirements: managementTransitionRequirements,
    deployPolicyPreflight,
    gitOpsRepositoryPolicyCheck,
    gitOpsDrift,
    releaseIntelligence,
  });
  const readinessClasses =
    readinessScorecard.state === 'ready'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
      : readinessScorecard.state === 'review'
        ? 'border-warning/40 bg-warning/10 text-warning-foreground'
        : 'border-destructive/40 bg-destructive/10 text-destructive';

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
  const rollbackConfidenceClasses =
    releaseIntelligence?.rollback.confidence === 'high'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : releaseIntelligence?.rollback.confidence === 'medium'
        ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
        : 'border-border/60 text-muted-foreground';
  const comparisonState = releaseIntelligence?.comparison.verdict ?? 'insufficient-data';
  const comparisonClasses =
    comparisonState === 'improved'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : comparisonState === 'steady'
        ? 'border-sky-500/40 text-sky-700 dark:text-sky-300'
        : comparisonState === 'regressed'
          ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
        : 'border-border/60 text-muted-foreground';
  const deployImpactBadgeClasses = (impact: ReleaseIntelligenceSummary['deployImpactTimeline'][number]['impact']) =>
    impact === 'improved'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : impact === 'steady'
        ? 'border-sky-500/40 text-sky-700 dark:text-sky-300'
        : impact === 'regressed'
          ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
          : 'border-border/60 text-muted-foreground';

  const desiredStateClasses =
    desiredStateValidationLoading
      ? 'border-border/60 text-muted-foreground'
      : desiredStateValidation?.status === 'verified'
        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
        : desiredStateValidation?.status === 'needs-review'
          ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
          : desiredStateValidation?.status === 'invalid'
            ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
            : 'border-border/60 text-muted-foreground';
  const desiredStateLabel =
    desiredStateValidationLoading
      ? 'Checking'
      : desiredStateValidation?.status === 'verified'
        ? 'Valid'
        : desiredStateValidation?.status === 'needs-review'
          ? 'Review'
          : desiredStateValidation?.status === 'invalid'
            ? 'Invalid'
            : 'Unavailable';

  const gitOpsStateLabel =
    gitOpsDriftLoading
      ? 'Checking'
      : gitOpsDrift?.state === 'in-sync'
        ? 'In sync'
        : gitOpsDrift?.state === 'missing'
          ? 'File missing'
          : gitOpsDrift?.state === 'out-of-sync'
            ? 'Drift'
            : 'Unavailable';
  const gitOpsStateClasses =
    gitOpsDriftLoading
      ? 'border-border/60 text-muted-foreground'
      : gitOpsDrift?.state === 'in-sync'
        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
        : gitOpsDrift?.state === 'missing'
          ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
          : gitOpsDrift?.state === 'out-of-sync'
            ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
          : 'border-border/60 text-muted-foreground';
  const repositoryPolicyClasses =
    gitOpsRepositoryPolicyCheckLoading
      ? 'border-border/60 text-muted-foreground'
      : gitOpsRepositoryPolicyCheck?.status === 'verified'
        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
        : gitOpsRepositoryPolicyCheck?.status === 'needs-review'
          ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
          : gitOpsRepositoryPolicyCheck?.status === 'invalid'
            ? 'border-rose-500/40 text-rose-700 dark:text-rose-300'
            : 'border-border/60 text-muted-foreground';
  const repositoryPolicyLabel =
    gitOpsRepositoryPolicyCheckLoading
      ? 'Checking'
      : gitOpsRepositoryPolicyCheck?.status === 'verified'
        ? 'Verified'
        : gitOpsRepositoryPolicyCheck?.status === 'needs-review'
          ? 'Review'
          : gitOpsRepositoryPolicyCheck?.status === 'invalid'
          ? 'Invalid'
            : 'Unavailable';
  const gitOpsSyncStatus = (() => {
    if ((service.managementMode ?? 'managed') === 'observed') {
      return {
        label: 'Observed',
        description: 'GitOps delivery stays limited until the service is switched back to managed mode.',
        className: 'border-border/60 text-muted-foreground',
      };
    }
    if (desiredStateValidationLoading || gitOpsRepositoryPolicyCheckLoading || gitOpsDriftLoading) {
      return {
        label: 'Checking',
        description: 'Releasea is refreshing GitOps validation, repository policy, and drift state.',
        className: 'border-border/60 text-muted-foreground',
      };
    }
    if (desiredStateValidation?.status === 'invalid' || gitOpsRepositoryPolicyCheck?.status === 'invalid') {
      return {
        label: 'Blocked',
        description:
          gitOpsRepositoryPolicyCheck?.status === 'invalid'
            ? gitOpsRepositoryPolicyCheck.summary
            : desiredStateValidation?.summary ?? 'GitOps delivery is blocked by the current desired-state contract.',
        className: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
      };
    }
    if (gitOpsDrift?.state === 'out-of-sync' || gitOpsDrift?.state === 'missing') {
      return {
        label: gitOpsDrift.state === 'missing' ? 'File missing' : 'Drift',
        description: gitOpsDrift.message,
        className:
          gitOpsDrift.state === 'missing'
            ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
            : 'border-rose-500/40 text-rose-700 dark:text-rose-300',
      };
    }
    if (
      desiredStateValidation?.status === 'verified' &&
      gitOpsRepositoryPolicyCheck?.status === 'verified' &&
      gitOpsDrift?.state === 'in-sync'
    ) {
      return {
        label: 'In sync',
        description: 'Desired state, repository policy, and committed GitOps state are aligned.',
        className: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
      };
    }
    return {
      label: 'Unavailable',
      description: 'GitOps sync status is not fully available for this service yet.',
      className: 'border-border/60 text-muted-foreground',
    };
  })();
  const gitOpsTimelineItems = gitOpsTimeline.slice(0, 5).map((event) => {
    const actionLabel =
      event.action === 'service.gitops_pr.create'
        ? 'GitOps PR created'
        : event.action === 'service.gitops_argocd_pr.create'
          ? 'Argo CD starter PR created'
          : event.action === 'service.gitops_flux_pr.create'
            ? 'Flux starter PR created'
            : event.action === 'service.gitops_drift.state_changed'
              ? 'Drift state changed'
              : 'GitOps event';
    const timeLabel = new Date(event.createdAt).toLocaleString();
    return {
      ...event,
      actionLabel,
      timeLabel,
    };
  });
  const gitOpsLayoutPresetItems = gitOpsLayoutPresets.map((preset) => {
    const matchesDesiredStatePath = Boolean(gitOpsDrift?.filePath) && gitOpsDrift?.filePath === preset.primaryFilePath;
    return {
      ...preset,
      matchesDesiredStatePath,
    };
  });

  return (
    <TabsContent value="delivery" className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Service readiness scorecard</h3>
              <p className="text-sm text-muted-foreground">
                Delivery, governance, GitOps, and operations signals combined into one pre-deploy view.
              </p>
            </div>
            <Badge variant="outline" className={cn('text-xs', readinessClasses)}>
              {readinessScorecard.score}% ready
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readinessScorecard.sections.map((section) => (
              <div key={section.id} className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{section.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {section.score}% ready
                      {section.id === 'gitops' && gitOpsDriftLoading ? ' · checking drift...' : ''}
                      {section.id === 'gitops' && gitOpsRepositoryPolicyCheckLoading ? ' · checking repo policy...' : ''}
                      {section.id === 'governance' && deployPolicyPreflightLoading ? ' · checking policy...' : ''}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      section.state === 'ready'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                        : section.state === 'review'
                          ? 'border-warning/40 bg-warning/10 text-warning-foreground'
                          : 'border-destructive/40 bg-destructive/10 text-destructive',
                    )}
                  >
                    {section.state === 'ready' ? 'Ready' : section.state === 'review' ? 'Review' : 'Blocked'}
                  </Badge>
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item.id} className="rounded border border-border/60 bg-background px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p>{item.message}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 text-[10px]',
                            item.state === 'ready'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                              : item.state === 'review'
                                ? 'border-warning/40 bg-warning/10 text-warning-foreground'
                                : 'border-destructive/40 bg-destructive/10 text-destructive',
                          )}
                        >
                          {item.state === 'ready' ? 'Ready' : item.state === 'review' ? 'Review' : 'Blocked'}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">GitOps delivery</h3>
            <p className="text-sm text-muted-foreground">
              Desired-state and repository alignment for the selected service.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Sync status</p>
                  <p className="text-xs text-muted-foreground">{gitOpsSyncStatus.description}</p>
                </div>
                <Badge variant="outline" className={cn('text-xs', gitOpsSyncStatus.className)}>
                  {gitOpsSyncStatus.label}
                </Badge>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Desired state validation</p>
                  <p className="text-xs text-muted-foreground">
                    {desiredStateValidation?.summary ?? 'Validation state is unavailable.'}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-xs', desiredStateClasses)}>
                  {desiredStateLabel}
                </Badge>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Repository policy</p>
                  <p className="text-xs text-muted-foreground">
                    {gitOpsRepositoryPolicyCheck?.summary ?? 'Repository policy checks are unavailable for this service.'}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-xs', repositoryPolicyClasses)}>
                  {repositoryPolicyLabel}
                </Badge>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Repository drift</p>
                  <p className="text-xs text-muted-foreground">
                    {gitOpsDrift?.message ?? 'Drift status is unavailable for this service.'}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-xs', gitOpsStateClasses)}>
                  {gitOpsStateLabel}
                </Badge>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">GitOps timeline</p>
                  <p className="text-xs text-muted-foreground">
                    Pull-request actions and drift state changes for this service.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {gitOpsTimelineLoading ? 'Refreshing' : `${gitOpsTimeline.length} event${gitOpsTimeline.length === 1 ? '' : 's'}`}
                </Badge>
              </div>
              <div className="space-y-2">
                {gitOpsTimelineItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No GitOps activity has been recorded for this service yet.</p>
                ) : (
                  gitOpsTimelineItems.map((event) => (
                    <div key={event.id} className="rounded border border-border/60 bg-background px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{event.actionLabel}</p>
                          <p className="text-xs text-muted-foreground">{event.message || 'GitOps event recorded.'}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-[10px] normal-case">
                            {event.status || 'recorded'}
                          </Badge>
                          <p className="mt-1 text-[11px] text-muted-foreground">{event.timeLabel}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Repository layout presets</p>
                  <p className="text-xs text-muted-foreground">
                    Canonical GitOps file layouts supported by Releasea for direct delivery and reconciler starters.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {gitOpsLayoutPresetsLoading ? 'Refreshing' : `${gitOpsLayoutPresetItems.length} preset${gitOpsLayoutPresetItems.length === 1 ? '' : 's'}`}
                </Badge>
              </div>
              <div className="space-y-2">
                {gitOpsLayoutPresetItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No GitOps layout presets are available for this service yet.</p>
                ) : (
                  gitOpsLayoutPresetItems.map((preset) => (
                    <div key={preset.id} className="rounded border border-border/60 bg-background px-3 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{preset.label}</p>
                            <Badge variant="outline" className="text-[10px] normal-case">
                              {preset.kind === 'starter' ? 'Starter' : 'Direct'}
                            </Badge>
                            {preset.matchesDesiredStatePath ? (
                              <Badge variant="outline" className="border-emerald-500/40 text-[10px] normal-case text-emerald-700 dark:text-emerald-300">
                                Current drift path
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{preset.description}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] normal-case',
                            preset.available
                              ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-border/60 text-muted-foreground',
                          )}
                        >
                          {preset.available ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Primary file:</span> {preset.primaryFilePath}
                        </p>
                        {preset.supportingFilePaths && preset.supportingFilePaths.length > 0 ? (
                          <p>
                            <span className="font-medium text-foreground">Supporting files:</span>{' '}
                            {preset.supportingFilePaths.join(', ')}
                          </p>
                        ) : null}
                        {!preset.available && preset.availabilityReason ? (
                          <p>{preset.availabilityReason}</p>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {managementMode === 'observed' && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Observed mode operating rules</h3>
            <p className="text-sm text-muted-foreground">
              Releasea keeps visibility and inventory, but delivery control stays locked until the service becomes managed.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {OBSERVED_MODE_RESTRICTIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Deploy policy preflight</h3>
              <p className="text-sm text-muted-foreground">
                Governance blockers for {viewEnvLabel} before the deploy modal is even opened.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                deployPolicyViolations.length > 0
                  ? deployPolicyDryRun
                    ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                    : 'border-rose-500/40 text-rose-700 dark:text-rose-300'
                  : deployPolicyExceptionsApplied.length > 0
                    ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {deployPolicyPreflightLoading
                ? 'Checking'
                : deployPolicyViolations.length > 0
                  ? deployPolicyDryRun
                    ? 'Warning'
                    : 'Blocked'
                  : deployPolicyExceptionsApplied.length > 0
                    ? 'Excepted'
                    : 'Clear'}
            </Badge>
          </div>
          {deployPolicyPreflightLoading ? (
            <p className="text-sm text-muted-foreground">Checking deploy policy for {viewEnvLabel}...</p>
          ) : deployPolicyViolations.length > 0 ? (
            <div
              className={cn(
                'rounded-md px-3 py-3 text-sm',
                deployPolicyDryRun
                  ? 'border border-amber-500/40 bg-amber-500/5'
                  : 'border border-warning/40 bg-warning/5',
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {deployPolicyDryRun ? 'Current warnings (dry-run)' : 'Current blockers'}
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    {deployPolicyViolations.map((violation, index) => (
                      <li key={`${violation.code}-${index}`}>{violation.message}</li>
                    ))}
                  </ul>
                  {deployPolicyExceptionsApplied.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {deployPolicyExceptionsApplied.length} temporary exception(s) are already applied, but blockers still remain.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : deployPolicyExceptionsApplied.length > 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Temporary exceptions are active</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {deployPolicyExceptionsApplied.map((exception) => (
                      <li key={exception.id}>
                        {exception.reason || 'Temporary exception active'} until {format(parseISO(exception.expiresAt), 'PPP p')}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No governance blockers are active for the selected environment.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Release Intelligence</h3>
              <p className="text-sm text-muted-foreground">
                Telemetry and release comparison around the latest successful deploy.
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
            <div className="space-y-3">
              {releaseIntelligence.anomalies.length > 0 ? (
                <div className="space-y-2">
                  {releaseIntelligence.anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className={cn(
                        'rounded-md border px-3 py-3 text-sm',
                        anomaly.severity === 'critical'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100'
                          : anomaly.severity === 'warning'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                            : 'border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100',
                      )}
                    >
                      <p className="font-medium">{anomaly.title}</p>
                      <p className="mt-1 text-xs opacity-90">{anomaly.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">Release Comparison</span>
                  </div>
                  <Badge variant="outline" className={`text-xs normal-case ${comparisonClasses}`}>
                    {comparisonState.replace('-', ' ')}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Latest successful release</p>
                    <p className="font-mono text-sm text-foreground">{releaseIntelligence.latestReleaseLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {releaseIntelligence.latestDeployAt
                        ? format(parseISO(releaseIntelligence.latestDeployAt), 'PPP p')
                        : 'Timestamp unavailable'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Previous successful release</p>
                    <p className="font-mono text-sm text-foreground">
                      {releaseIntelligence.previousReleaseLabel ?? '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {releaseIntelligence.previousDeployAt
                        ? format(parseISO(releaseIntelligence.previousDeployAt), 'PPP p')
                        : 'Timestamp unavailable'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Latency delta</p>
                    <p className="font-semibold text-foreground">
                      {releaseIntelligence.comparison.latencyChangePct == null
                        ? '--'
                        : `${releaseIntelligence.comparison.latencyChangePct}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">5xx delta</p>
                    <p className="font-semibold text-foreground">
                      {releaseIntelligence.comparison.errorRateChangePct == null
                        ? '--'
                        : `${releaseIntelligence.comparison.errorRateChangePct}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Availability delta</p>
                    <p className="font-semibold text-foreground">
                      {releaseIntelligence.comparison.availabilityChangePctPoints == null
                        ? '--'
                        : `${releaseIntelligence.comparison.availabilityChangePctPoints} pts`}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  {releaseIntelligence.comparison.summary}
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
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
                    <p className="text-xs text-muted-foreground">Target {releaseIntelligence.slo.availabilityTargetPct}%</p>
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
                    <p className="text-xs text-muted-foreground">Target {releaseIntelligence.slo.latencyTargetMs} ms</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
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
                <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Rollback confidence</span>
                    <Badge variant="outline" className={`text-xs normal-case ${rollbackConfidenceClasses}`}>
                      {releaseIntelligence.rollback.confidence}
                    </Badge>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {releaseIntelligence.rollback.factors.map((factor) => (
                      <li key={factor}>• {factor}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Deploy Impact Timeline</span>
                </div>
                <div className="space-y-3">
                  {releaseIntelligence.deployImpactTimeline.map((entry) => (
                    <div key={entry.deployId} className="rounded-md border border-border/60 bg-background/60 p-3 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono text-sm text-foreground">{entry.releaseLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.deployedAt ? format(parseISO(entry.deployedAt), 'PPP p') : 'Timestamp unavailable'}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-xs normal-case ${deployImpactBadgeClasses(entry.impact)}`}>
                          {entry.impact.replace('-', ' ')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Latency before</p>
                          <p className="font-semibold text-foreground">
                            {entry.latencyBeforeMs == null ? '--' : `${entry.latencyBeforeMs} ms`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Latency after</p>
                          <p className="font-semibold text-foreground">
                            {entry.latencyAfterMs == null ? '--' : `${entry.latencyAfterMs} ms`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">5xx before</p>
                          <p className="font-semibold text-foreground">
                            {entry.errorRateBeforePct == null ? '--' : `${entry.errorRateBeforePct}%`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">5xx after</p>
                          <p className="font-semibold text-foreground">
                            {entry.errorRateAfterPct == null ? '--' : `${entry.errorRateAfterPct}%`}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.summary}</p>
                    </div>
                  ))}
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
    </TabsContent>
  );
};
