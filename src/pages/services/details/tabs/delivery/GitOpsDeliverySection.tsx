import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/layout/SectionCard';
import { cn } from '@/lib/utils';
import { GitBranch } from 'lucide-react';
import type {
  Service,
  ServiceDesiredStateValidation,
  ServiceGitOpsDriftStatus,
  ServiceGitOpsLayoutPreset,
  ServiceGitOpsRepositoryPolicyCheck,
  ServiceGitOpsTimelineEvent,
} from '@/types/releasea';
import { StatusRow } from './StatusRow';
import {
  validationClasses,
  validationLabel,
  driftStateClasses,
  driftStateLabel,
} from './status-classes';

interface GitOpsDeliverySectionProps {
  service: Service;
  gitOpsRepositoryPolicyCheck: ServiceGitOpsRepositoryPolicyCheck | null;
  gitOpsRepositoryPolicyCheckLoading: boolean;
  gitOpsDrift: ServiceGitOpsDriftStatus | null;
  gitOpsDriftLoading: boolean;
  gitOpsLayoutPresets: ServiceGitOpsLayoutPreset[];
  gitOpsLayoutPresetsLoading: boolean;
  gitOpsTimeline: ServiceGitOpsTimelineEvent[];
  gitOpsTimelineLoading: boolean;
  desiredStateValidation: ServiceDesiredStateValidation | null;
  desiredStateValidationLoading: boolean;
}

function resolveSyncStatus(
  service: Service,
  desiredStateValidation: ServiceDesiredStateValidation | null,
  desiredStateValidationLoading: boolean,
  gitOpsRepositoryPolicyCheck: ServiceGitOpsRepositoryPolicyCheck | null,
  gitOpsRepositoryPolicyCheckLoading: boolean,
  gitOpsDrift: ServiceGitOpsDriftStatus | null,
  gitOpsDriftLoading: boolean,
) {
  const managementMode = service.managementMode ?? 'managed';
  if (managementMode === 'observed') {
    return { label: 'Observed', description: 'GitOps delivery stays limited until the service is switched back to managed mode.', classes: 'border-border/60 text-muted-foreground' };
  }
  if (desiredStateValidationLoading || gitOpsRepositoryPolicyCheckLoading || gitOpsDriftLoading) {
    return { label: 'Checking', description: 'Releasea is refreshing GitOps validation, repository policy, and drift state.', classes: 'border-border/60 text-muted-foreground' };
  }
  if (desiredStateValidation?.status === 'invalid' || gitOpsRepositoryPolicyCheck?.status === 'invalid') {
    return {
      label: 'Blocked',
      description: gitOpsRepositoryPolicyCheck?.status === 'invalid'
        ? gitOpsRepositoryPolicyCheck.summary
        : desiredStateValidation?.summary ?? 'GitOps delivery is blocked by the current desired-state contract.',
      classes: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
    };
  }
  if (gitOpsDrift?.state === 'out-of-sync' || gitOpsDrift?.state === 'missing') {
    return {
      label: gitOpsDrift.state === 'missing' ? 'File missing' : 'Drift',
      description: gitOpsDrift.message,
      classes: gitOpsDrift.state === 'missing'
        ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
        : 'border-rose-500/40 text-rose-700 dark:text-rose-300',
    };
  }
  if (desiredStateValidation?.status === 'verified' && gitOpsRepositoryPolicyCheck?.status === 'verified' && gitOpsDrift?.state === 'in-sync') {
    return { label: 'In sync', description: 'Desired state, repository policy, and committed GitOps state are aligned.', classes: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' };
  }
  return { label: 'Unavailable', description: 'GitOps sync status is not fully available for this service yet.', classes: 'border-border/60 text-muted-foreground' };
}

function formatTimelineAction(action: string) {
  switch (action) {
    case 'service.gitops_pr.create': return 'GitOps PR created';
    case 'service.gitops_argocd_pr.create': return 'Argo CD starter PR created';
    case 'service.gitops_flux_pr.create': return 'Flux starter PR created';
    case 'service.gitops_drift.state_changed': return 'Drift state changed';
    default: return 'GitOps event';
  }
}

export function GitOpsDeliverySection({
  service,
  gitOpsRepositoryPolicyCheck,
  gitOpsRepositoryPolicyCheckLoading,
  gitOpsDrift,
  gitOpsDriftLoading,
  gitOpsLayoutPresets,
  gitOpsLayoutPresetsLoading,
  gitOpsTimeline,
  gitOpsTimelineLoading,
  desiredStateValidation,
  desiredStateValidationLoading,
}: GitOpsDeliverySectionProps) {
  const syncStatus = resolveSyncStatus(service, desiredStateValidation, desiredStateValidationLoading, gitOpsRepositoryPolicyCheck, gitOpsRepositoryPolicyCheckLoading, gitOpsDrift, gitOpsDriftLoading);

  const timelineItems = gitOpsTimeline.slice(0, 5);
  const layoutPresetItems = gitOpsLayoutPresets.map((p) => ({
    ...p,
    matchesDrift: Boolean(gitOpsDrift?.filePath) && gitOpsDrift?.filePath === p.primaryFilePath,
  }));

  return (
    <SectionCard
      title="GitOps delivery"
      description="Desired-state and repository alignment for this service."
      icon={<GitBranch className="w-4 h-4 text-primary" />}
      headerRight={
        <Badge variant="outline" className={cn('text-xs uppercase tracking-wider', syncStatus.classes)}>
          {syncStatus.label}
        </Badge>
      }
      contentClassName="space-y-3"
    >
      {/* Core status rows */}
      <StatusRow
        label="Sync status"
        description={syncStatus.description}
        badgeLabel={syncStatus.label}
        badgeClasses={syncStatus.classes}
      />
      <StatusRow
        label="Desired state validation"
        description={desiredStateValidation?.summary ?? 'Validation state is unavailable.'}
        badgeLabel={validationLabel(desiredStateValidation?.status, desiredStateValidationLoading)}
        badgeClasses={validationClasses(desiredStateValidation?.status, desiredStateValidationLoading)}
      />
      <StatusRow
        label="Repository policy"
        description={gitOpsRepositoryPolicyCheck?.summary ?? 'Repository policy checks are unavailable for this service.'}
        badgeLabel={validationLabel(gitOpsRepositoryPolicyCheck?.status, gitOpsRepositoryPolicyCheckLoading)}
        badgeClasses={validationClasses(gitOpsRepositoryPolicyCheck?.status, gitOpsRepositoryPolicyCheckLoading)}
      />
      <StatusRow
        label="Repository drift"
        description={gitOpsDrift?.message ?? 'Drift status is unavailable for this service.'}
        badgeLabel={driftStateLabel(gitOpsDrift?.state, gitOpsDriftLoading)}
        badgeClasses={driftStateClasses(gitOpsDrift?.state, gitOpsDriftLoading)}
      />

      {/* Timeline */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline</p>
          <Badge variant="outline" className="text-[10px]">
            {gitOpsTimelineLoading ? 'Refreshing' : `${gitOpsTimeline.length} event${gitOpsTimeline.length === 1 ? '' : 's'}`}
          </Badge>
        </div>
        {timelineItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No GitOps activity has been recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {timelineItems.map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 rounded border border-border/40 bg-background/60 px-3 py-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-foreground">{formatTimelineAction(event.action)}</p>
                  <p className="text-[11px] text-muted-foreground">{event.message || 'Event recorded.'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                    {event.status || 'recorded'}
                  </Badge>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layout presets */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Layout presets</p>
          <Badge variant="outline" className="text-[10px]">
            {gitOpsLayoutPresetsLoading ? 'Refreshing' : `${layoutPresetItems.length} preset${layoutPresetItems.length === 1 ? '' : 's'}`}
          </Badge>
        </div>
        {layoutPresetItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No layout presets are available yet.</p>
        ) : (
          <div className="space-y-1.5">
            {layoutPresetItems.map((preset) => (
              <div key={preset.id} className="rounded border border-border/40 bg-background/60 px-3 py-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground">{preset.label}</p>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                      {preset.kind === 'starter' ? 'Starter' : 'Direct'}
                    </Badge>
                    {preset.matchesDrift && (
                      <Badge variant="outline" className="border-emerald-500/40 text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Current path
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] uppercase tracking-wider',
                      preset.available
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-border/60 text-muted-foreground',
                    )}
                  >
                    {preset.available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{preset.description}</p>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p><span className="font-medium text-foreground">Primary:</span> {preset.primaryFilePath}</p>
                  {preset.supportingFilePaths?.length > 0 && (
                    <p><span className="font-medium text-foreground">Supporting:</span> {preset.supportingFilePaths.join(', ')}</p>
                  )}
                  {!preset.available && preset.availabilityReason && <p>{preset.availabilityReason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
