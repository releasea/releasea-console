import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { Activity, AlertTriangle, CheckCircle2, GitBranch, History, Rocket, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { buildServiceReadinessScorecard, type ServiceReadinessItemState } from '@/lib/service-readiness';
import { cn } from '@/lib/utils';
import { ServiceTabHeader } from '../ServiceTabHeader';

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
  initialSection?: 'overview' | 'governance' | 'gitops' | 'intelligence';
};

type StatusState = ServiceReadinessItemState | 'neutral' | 'info';

const toneByState: Record<StatusState, string> = {
  ready: 'border-success/30 bg-success/10 text-success',
  review: 'border-warning/30 bg-warning/10 text-warning',
  blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'border-border/70 bg-muted/40 text-muted-foreground',
  info: 'border-info/30 bg-info/10 text-info',
};

const statusLabel: Record<ServiceReadinessItemState, string> = {
  ready: 'Ready',
  review: 'Review',
  blocked: 'Blocked',
};

const panelClass = 'rounded-xl border border-border/70 bg-card shadow-sm';

const safeDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  try {
    return format(parseISO(value), 'PPP p');
  } catch {
    return 'Date unavailable';
  }
};

const metricValue = (value: number | null, suffix: string) => value == null ? 'No signal' : `${value}${suffix}`;

const StatusBadge = ({ state, label }: { state: StatusState; label: string }) => (
  <Badge variant="outline" className={cn('shrink-0 text-[11px] font-medium normal-case', toneByState[state])}>
    {label}
  </Badge>
);

const SectionHeading = ({ title, description, aside }: { title: string; description: string; aside?: ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="max-w-2xl space-y-1">
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
    {aside}
  </div>
);

const SignalCard = ({ label, value, description, icon, badge }: {
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
  badge?: ReactNode;
}) => (
  <div className={cn(panelClass, 'flex min-h-36 flex-col justify-between p-4')}>
    <div className="flex items-start justify-between gap-3">
      <span className="rounded-lg border border-border/60 bg-muted/50 p-2 text-muted-foreground">{icon}</span>
      {badge}
    </div>
    <div className="mt-5 min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground" title={value}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  </div>
);

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className={cn(panelClass, 'flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center')}>
    <div className="rounded-full border border-border/60 bg-muted/50 p-3 text-muted-foreground">
      <Activity className="h-5 w-5" />
    </div>
    <h4 className="mt-4 text-sm font-semibold text-foreground">{title}</h4>
    <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">{description}</p>
  </div>
);

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
  initialSection = 'overview',
}: DeliveryTabProps) => {
  const policyViolations = Array.isArray(deployPolicyPreflight?.violations) ? deployPolicyPreflight.violations : [];
  const policyExceptions = Array.isArray(deployPolicyPreflight?.exceptionsApplied) ? deployPolicyPreflight.exceptionsApplied : [];
  const policyDryRun = deployPolicyPreflight?.dryRun === true;
  const managementMode = service.managementMode ?? 'managed';
  const readiness = buildServiceReadinessScorecard({
    service,
    requirements: managementTransitionRequirements,
    deployPolicyPreflight,
    gitOpsRepositoryPolicyCheck,
    gitOpsDrift,
    releaseIntelligence,
  });
  const readinessItems = readiness.sections.flatMap((section) => section.items.map((item) => ({ ...item, group: section.label })));
  const deployDecisionItems = readiness.sections
    .filter((section) => section.id === 'delivery' || section.id === 'governance')
    .flatMap((section) => section.items.map((item) => ({ ...item, group: section.label })));
  const attentionItems = deployDecisionItems.filter((item) => item.state !== 'ready');
  const nextAttentionItem = attentionItems.find((item) => item.state === 'blocked') ?? attentionItems[0] ?? null;

  const policyState: StatusState = deployPolicyPreflightLoading
    ? 'neutral'
    : policyViolations.length > 0 ? (policyDryRun ? 'review' : 'blocked') : policyExceptions.length > 0 ? 'review' : 'ready';
  const policyLabel = deployPolicyPreflightLoading
    ? 'Checking'
    : policyViolations.length > 0 ? (policyDryRun ? 'Warning' : 'Blocked') : policyExceptions.length > 0 ? 'Exception active' : 'Clear';

  const desiredState: { state: StatusState; label: string; description: string } = desiredStateValidationLoading
    ? { state: 'neutral', label: 'Checking', description: 'Refreshing the desired-state validation.' }
    : desiredStateValidation?.status === 'verified'
      ? { state: 'ready', label: 'Valid', description: desiredStateValidation.summary }
      : desiredStateValidation?.status === 'invalid'
        ? { state: 'blocked', label: 'Invalid', description: desiredStateValidation.summary }
        : desiredStateValidation?.status === 'needs-review'
          ? { state: 'review', label: 'Review', description: desiredStateValidation.summary }
          : { state: 'neutral', label: 'Unavailable', description: 'No desired-state validation is available.' };

  const repositoryPolicy: { state: StatusState; label: string; description: string } = gitOpsRepositoryPolicyCheckLoading
    ? { state: 'neutral', label: 'Checking', description: 'Refreshing repository policy checks.' }
    : gitOpsRepositoryPolicyCheck?.status === 'verified'
      ? { state: 'ready', label: 'Verified', description: gitOpsRepositoryPolicyCheck.summary }
      : gitOpsRepositoryPolicyCheck?.status === 'invalid'
        ? { state: 'blocked', label: 'Invalid', description: gitOpsRepositoryPolicyCheck.summary }
        : gitOpsRepositoryPolicyCheck?.status === 'needs-review'
          ? { state: 'review', label: 'Review', description: gitOpsRepositoryPolicyCheck.summary }
          : { state: 'neutral', label: 'Unavailable', description: 'No repository policy result is available.' };

  const drift: { state: StatusState; label: string; description: string } = gitOpsDriftLoading
    ? { state: 'neutral', label: 'Checking', description: 'Comparing the repository with the expected state.' }
    : gitOpsDrift?.state === 'in-sync'
      ? { state: 'ready', label: 'In sync', description: gitOpsDrift.message }
      : gitOpsDrift?.state === 'out-of-sync'
        ? { state: 'blocked', label: 'Drift', description: gitOpsDrift.message }
      : gitOpsDrift?.state === 'missing'
          ? { state: 'neutral', label: 'Not configured', description: 'GitOps is optional and no desired-state file has been added to this repository yet.' }
          : { state: 'neutral', label: 'Unavailable', description: 'No repository drift result is available.' };

  const gitOpsSync: { state: StatusState; label: string; description: string } = (() => {
    if (managementMode === 'observed') return { state: 'neutral', label: 'Observed', description: 'Delivery control is intentionally limited while this service is observed-only.' };
    if (desiredStateValidationLoading || gitOpsRepositoryPolicyCheckLoading || gitOpsDriftLoading) return { state: 'neutral', label: 'Checking', description: 'Refreshing all GitOps delivery checks.' };
    if (desiredState.state === 'blocked' || repositoryPolicy.state === 'blocked') return {
      state: 'blocked',
      label: 'Blocked',
      description: repositoryPolicy.state === 'blocked' ? repositoryPolicy.description : desiredState.description,
    };
    if (gitOpsDrift?.state === 'missing') return {
      state: 'neutral',
      label: 'Not configured',
      description: 'GitOps is optional for this service. Create a GitOps pull request when repository-driven desired state is required.',
    };
    if (drift.state === 'blocked' || drift.state === 'review') return drift;
    if (desiredState.state === 'ready' && repositoryPolicy.state === 'ready' && drift.state === 'ready') return { state: 'ready', label: 'In sync', description: 'Desired state, policy, and repository content agree.' };
    return { state: 'neutral', label: 'Unavailable', description: 'GitOps status is not fully available yet.' };
  })();

  const timelineItems = gitOpsTimeline.slice(0, 5).map((event) => ({
    ...event,
    label: event.action === 'service.gitops_pr.create'
      ? 'GitOps PR created'
      : event.action === 'service.gitops_argocd_pr.create'
        ? 'Argo CD starter PR created'
        : event.action === 'service.gitops_flux_pr.create'
          ? 'Flux starter PR created'
          : event.action === 'service.gitops_drift.state_changed' ? 'Drift state changed' : 'GitOps event',
  }));

  const sloState = releaseIntelligence?.slo.overallState ?? 'unknown';
  const hasCompleteSloSignal = releaseIntelligence?.slo.availabilityPct != null && releaseIntelligence.slo.latencyP95AvgMs != null;
  const healthPostureLabel = releaseIntelligence
    ? hasCompleteSloSignal ? sloState.replace('-', ' ') : 'Partial signal'
    : 'Awaiting data';
  const availabilityState = releaseIntelligence?.slo.availabilityState ?? 'unknown';
  const availabilityTone: StatusState = availabilityState === 'meeting' ? 'ready' : availabilityState === 'at-risk' ? 'review' : availabilityState === 'breached' ? 'blocked' : 'neutral';
  const latencyState = releaseIntelligence?.slo.latencyState ?? 'unknown';
  const latencyTone: StatusState = latencyState === 'meeting' ? 'ready' : latencyState === 'at-risk' ? 'review' : latencyState === 'breached' ? 'blocked' : 'neutral';
  const rollbackRecommendation = releaseIntelligence?.rollback.recommendation ?? 'insufficient-data';
  const rollbackTone: StatusState = rollbackRecommendation === 'stable' ? 'ready' : rollbackRecommendation === 'watch' ? 'review' : rollbackRecommendation === 'rollback' ? 'blocked' : 'neutral';
  const navItems = [
    { value: 'overview', label: 'Overview', description: `${readiness.score}% ready` },
    { value: 'governance', label: 'Governance', description: policyLabel },
    { value: 'gitops', label: 'GitOps', description: gitOpsSync.label },
    { value: 'intelligence', label: 'Release health', description: healthPostureLabel },
  ];

  return (
    <TabsContent value="delivery" className="space-y-6">
      <ServiceTabHeader
        title="Delivery"
        description="Decide whether this service is ready to deploy, then inspect only the signal that needs attention."
        environment={viewEnvLabel}
      />
      <Tabs defaultValue={initialSection} className="space-y-6">
        <div className={cn(panelClass, 'overflow-x-auto p-1.5')}>
          <TabsList className="!grid h-auto min-w-[680px] grid-cols-4 gap-1 bg-transparent p-0">
            {navItems.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="h-auto w-full !justify-start rounded-lg px-4 py-3 !text-left data-[state=active]:bg-muted data-[state=active]:shadow-none">
                <span>
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-xs font-normal capitalize text-muted-foreground">{item.description}</span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <section className={cn(panelClass, 'flex min-h-56 flex-col justify-between p-6')}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Rocket className="h-4 w-4" />Deploy decision</div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    {readiness.state === 'ready' ? `Ready for ${viewEnvLabel}` : readiness.state === 'blocked' ? `Blocked for ${viewEnvLabel}` : `Review before ${viewEnvLabel}`}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {nextAttentionItem ? `${nextAttentionItem.label}: ${nextAttentionItem.message}` : 'All available delivery checks are clear for the selected environment.'}
                  </p>
                </div>
                <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-8 border-muted bg-background">
                  <span className="text-2xl font-semibold tracking-tight text-foreground">{readiness.score}%</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">ready</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <StatusBadge state={readiness.state} label={statusLabel[readiness.state]} />
                <span className="text-xs text-muted-foreground">{attentionItems.length === 0 ? 'No open checks' : `${attentionItems.length} check${attentionItems.length === 1 ? '' : 's'} need attention`}</span>
              </div>
            </section>
            <section className={cn(panelClass, 'p-6')}>
              <SectionHeading title="Next action" description="The highest-priority item to resolve before promoting this service." />
              <div className="mt-6 flex gap-3">
                <span className={cn('mt-0.5 rounded-full p-2', toneByState[nextAttentionItem?.state ?? 'ready'])}>
                  {nextAttentionItem ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{nextAttentionItem?.label ?? 'Continue with deployment'}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{nextAttentionItem?.message ?? 'No delivery blocker is currently visible.'}</p>
                  {nextAttentionItem ? <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{nextAttentionItem.group}</p> : null}
                </div>
              </div>
            </section>
          </div>

          <section className={cn(panelClass, 'p-5')}>
            <SectionHeading title="Pre-deploy checklist" description="One concise view of every check used in the deploy decision." aside={<StatusBadge state={readiness.state} label={`${readiness.score}% ready`} />} />
            <div className="mt-5 divide-y divide-border/60 border-y border-border/60">
              {readiness.sections.map((section) => (
                <div key={section.id} className="grid gap-3 py-4 md:grid-cols-[180px_1fr]">
                  <div className="flex items-start justify-between gap-3 md:block">
                    <p className="text-sm font-medium text-foreground">{section.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{section.score}% complete</p>
                  </div>
                  <div className="space-y-3">
                    {section.items.length > 0 ? section.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.message}</p>
                        </div>
                        <StatusBadge state={item.state} label={statusLabel[item.state]} />
                      </div>
                    )) : (
                      <div className="flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">No additional requirements are configured.</p><StatusBadge state="ready" label="Ready" /></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {managementMode === 'observed' ? (
            <section className={cn(panelClass, 'border-info/30 bg-info/5 p-5')}>
              <SectionHeading title="Observed mode" description="Releasea provides visibility, while deploy control remains outside the platform." aside={<StatusBadge state="info" label="Limited control" />} />
              <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                {OBSERVED_MODE_RESTRICTIONS.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}
              </ul>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="governance" className="mt-0 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <SignalCard label="Deploy policy" value={policyLabel} description={`Evaluation for ${viewEnvLabel}.`} icon={<ShieldCheck className="h-4 w-4" />} badge={<StatusBadge state={policyState} label={policyLabel} />} />
            <SignalCard label="Active blockers" value={deployPolicyPreflightLoading ? 'Checking' : String(policyViolations.length)} description={policyDryRun ? 'Reported as warnings in dry-run mode.' : 'Rules currently preventing a clean deploy.'} icon={<AlertTriangle className="h-4 w-4" />} />
            <SignalCard label="Temporary exceptions" value={deployPolicyPreflightLoading ? 'Checking' : String(policyExceptions.length)} description="Time-bound exceptions applied to this evaluation." icon={<History className="h-4 w-4" />} />
          </div>
          <section className={cn(panelClass, 'p-5')}>
            <SectionHeading title="Policy evaluation" description={`Rules evaluated before opening a deploy to ${viewEnvLabel}.`} aside={<StatusBadge state={policyState} label={policyLabel} />} />
            <div className="mt-5">
              {deployPolicyPreflightLoading ? <p className="text-sm text-muted-foreground">Checking deploy policy…</p> : policyViolations.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">{policyDryRun ? 'Current warnings (dry-run)' : 'Current blockers'}</h4>
                  <div className="divide-y divide-border/60 rounded-lg border border-border/60">
                    {policyViolations.map((violation, index) => (
                      <div key={`${violation.code}-${index}`} className="flex items-start gap-3 px-4 py-3">
                        <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', policyDryRun ? 'text-warning' : 'text-destructive')} />
                        <div><p className="text-sm text-foreground">{violation.message}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{violation.code}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div><p className="text-sm font-medium text-foreground">No policy blockers</p><p className="mt-1 text-sm text-muted-foreground">The selected environment passes the current deploy policy evaluation.</p></div>
                </div>
              )}
            </div>
          </section>
          {policyExceptions.length > 0 ? (
            <section className={cn(panelClass, 'p-5')}>
              <SectionHeading title="Active exceptions" description="Review why each policy bypass exists and when it expires." aside={<StatusBadge state="review" label={`${policyExceptions.length} active`} />} />
              <div className="mt-5 divide-y divide-border/60 border-y border-border/60">
                {policyExceptions.map((exception) => <div key={exception.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-6"><p className="text-sm text-foreground">{exception.reason || 'Temporary policy exception'}</p><p className="text-xs text-muted-foreground">Expires {safeDate(exception.expiresAt)}</p></div>)}
              </div>
            </section>
          ) : null}
          {managementMode === 'observed' ? <section className={cn(panelClass, 'p-5')}><SectionHeading title="Control ownership" description="This service is observed-only, so Releasea evaluates policy without owning delivery actions." aside={<StatusBadge state="neutral" label="Observed" />} /></section> : null}
        </TabsContent>

        <TabsContent value="gitops" className="mt-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Overall sync', signal: gitOpsSync, icon: <GitBranch className="h-4 w-4" /> },
              { label: 'Desired state', signal: desiredState, icon: <CheckCircle2 className="h-4 w-4" /> },
              { label: 'Repository policy', signal: repositoryPolicy, icon: <ShieldCheck className="h-4 w-4" /> },
              { label: 'Repository drift', signal: drift, icon: <Activity className="h-4 w-4" /> },
            ].map(({ label, signal, icon }) => <SignalCard key={label} label={label} value={signal.label} description={signal.description} icon={icon} badge={<StatusBadge state={signal.state} label={signal.label} />} />)}
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className={cn(panelClass, 'p-5')}>
              <SectionHeading title="Recent activity" description="The latest pull-request and drift events for this service." aside={<StatusBadge state="neutral" label={gitOpsTimelineLoading ? 'Refreshing' : `${gitOpsTimeline.length} events`} />} />
              <div className="mt-5">
                {timelineItems.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No GitOps activity recorded yet.</p> : (
                  <div className="divide-y divide-border/60 border-y border-border/60">
                    {timelineItems.map((event) => <div key={event.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:gap-5"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{event.label}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{event.message || 'GitOps event recorded.'}</p></div><div className="text-left sm:text-right"><p className="text-xs capitalize text-foreground">{event.status || 'Recorded'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{safeDate(event.createdAt)}</p></div></div>)}
                  </div>
                )}
              </div>
            </section>
            <section className={cn(panelClass, 'p-5')}>
              <SectionHeading title="Repository layouts" description="Supported file structures. Expand a layout only when you need its exact paths." aside={<StatusBadge state="neutral" label={gitOpsLayoutPresetsLoading ? 'Refreshing' : `${gitOpsLayoutPresets.length} layouts`} />} />
              <div className="mt-5 space-y-2">
                {gitOpsLayoutPresets.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No repository layouts are available.</p> : gitOpsLayoutPresets.map((preset) => {
                  const isCurrent = Boolean(gitOpsDrift?.filePath) && gitOpsDrift?.filePath === preset.primaryFilePath;
                  return (
                    <details key={preset.id} className="group rounded-lg border border-border/60 bg-background open:bg-muted/20">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:hidden">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-foreground">{preset.label}</p>{isCurrent ? <StatusBadge state="ready" label="Drift path" /> : null}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{preset.primaryFilePath}</p></div>
                        <StatusBadge state={preset.available ? 'ready' : 'neutral'} label={preset.available ? (preset.kind === 'starter' ? 'Starter' : 'Direct') : 'Unavailable'} />
                      </summary>
                      <div className="border-t border-border/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
                        <p>{preset.description}</p>
                        {preset.supportingFilePaths?.length ? <div className="mt-3"><p className="font-medium text-foreground">Supporting files</p><ul className="mt-1 space-y-1 font-mono text-[11px]">{preset.supportingFilePaths.map((path) => <li key={path}>{path}</li>)}</ul></div> : null}
                        {!preset.available && preset.availabilityReason ? <p className="mt-3">{preset.availabilityReason}</p> : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="intelligence" className="mt-0 space-y-6">
          {releaseIntelligence ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SignalCard label="Availability" value={metricValue(releaseIntelligence.slo.availabilityPct, '%')} description={`Target ${releaseIntelligence.slo.availabilityTargetPct}%`} icon={<CheckCircle2 className="h-4 w-4" />} badge={<StatusBadge state={availabilityTone} label={availabilityState === 'unknown' ? 'No signal' : availabilityState.replace('-', ' ')} />} />
                <SignalCard label="5xx error rate" value={metricValue(releaseIntelligence.slo.errorRatePct, '%')} description="Current telemetry window" icon={<AlertTriangle className="h-4 w-4" />} />
                <SignalCard label="Latency p95" value={metricValue(releaseIntelligence.slo.latencyP95AvgMs, ' ms')} description={`Target ${releaseIntelligence.slo.latencyTargetMs} ms`} icon={<Activity className="h-4 w-4" />} badge={<StatusBadge state={latencyTone} label={latencyState === 'unknown' ? 'No signal' : latencyState.replace('-', ' ')} />} />
                <SignalCard label="Rollback guidance" value={rollbackRecommendation.replace('-', ' ')} description={`${releaseIntelligence.rollback.confidence} confidence`} icon={<History className="h-4 w-4" />} badge={<StatusBadge state={rollbackTone} label={rollbackRecommendation.replace('-', ' ')} />} />
              </div>
              {releaseIntelligence.anomalies.length > 0 ? (
                <section className={cn(panelClass, 'p-5')}>
                  <SectionHeading title="Signals requiring attention" description="Anomalies detected in the current release window." aside={<StatusBadge state="review" label={`${releaseIntelligence.anomalies.length} detected`} />} />
                  <div className="mt-5 divide-y divide-border/60 border-y border-border/60">
                    {releaseIntelligence.anomalies.map((anomaly) => <div key={anomaly.id} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-medium text-foreground">{anomaly.title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{anomaly.detail}</p></div><StatusBadge state={anomaly.severity === 'critical' ? 'blocked' : anomaly.severity === 'warning' ? 'review' : 'info'} label={anomaly.severity} /></div>)}
                  </div>
                </section>
              ) : null}
              <div className="grid items-start gap-6 xl:grid-cols-2">
                <section className={cn(panelClass, 'p-5')}>
                  <SectionHeading title="Latest release comparison" description="Change in service behavior after the latest successful deploy." aside={<StatusBadge state={releaseIntelligence.comparison.verdict === 'improved' ? 'ready' : releaseIntelligence.comparison.verdict === 'regressed' ? 'blocked' : releaseIntelligence.comparison.verdict === 'steady' ? 'info' : 'neutral'} label={releaseIntelligence.comparison.verdict.replace('-', ' ')} />} />
                  <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div><p className="text-xs text-muted-foreground">Latest</p><p className="mt-1 font-mono text-sm font-medium text-foreground">{releaseIntelligence.latestReleaseLabel}</p><p className="mt-1 text-[11px] text-muted-foreground">{safeDate(releaseIntelligence.latestDeployAt)}</p></div>
                    <div className="border-l border-border/60 pl-4"><p className="text-xs text-muted-foreground">Previous</p><p className="mt-1 font-mono text-sm font-medium text-foreground">{releaseIntelligence.previousReleaseLabel ?? 'No previous release'}</p><p className="mt-1 text-[11px] text-muted-foreground">{safeDate(releaseIntelligence.previousDeployAt)}</p></div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 py-3 text-center">
                    {[
                      ['Latency', metricValue(releaseIntelligence.comparison.latencyChangePct, '%')],
                      ['5xx rate', metricValue(releaseIntelligence.comparison.errorRateChangePct, '%')],
                      ['Availability', metricValue(releaseIntelligence.comparison.availabilityChangePctPoints, ' pts')],
                    ].map(([label, value]) => <div key={label} className="px-2"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>)}
                  </div>
                  <p className="mt-4 text-sm leading-5 text-muted-foreground">{releaseIntelligence.comparison.summary}</p>
                </section>
                <section className={cn(panelClass, 'p-5')}>
                  <SectionHeading title="Rollback assessment" description="Evidence available if the latest release needs to be reversed." aside={<StatusBadge state={rollbackTone} label={`${releaseIntelligence.rollback.confidence} confidence`} />} />
                  <p className="mt-5 text-sm leading-6 text-muted-foreground">{releaseIntelligence.rollback.message}</p>
                  <div className="mt-4 divide-y divide-border/60 border-y border-border/60">
                    {releaseIntelligence.rollback.factors.length > 0 ? releaseIntelligence.rollback.factors.map((factor) => <div key={factor} className="flex gap-3 py-3 text-sm text-muted-foreground"><span aria-hidden="true">•</span><span>{factor}</span></div>) : <p className="py-4 text-sm text-muted-foreground">No rollback factors are available yet.</p>}
                  </div>
                </section>
              </div>
              <section className={cn(panelClass, 'p-5')}>
                <SectionHeading title="Release history" description="Impact classification for recent successful deploys. Expand an entry for raw before-and-after values." aside={<StatusBadge state="neutral" label={`${releaseIntelligence.deployImpactTimeline.length} releases`} />} />
                <div className="mt-5 divide-y divide-border/60 border-y border-border/60">
                  {releaseIntelligence.deployImpactTimeline.map((entry) => {
                    const impactState: StatusState = entry.impact === 'improved' ? 'ready' : entry.impact === 'regressed' ? 'blocked' : entry.impact === 'steady' ? 'info' : 'neutral';
                    return (
                      <details key={entry.deployId} className="group">
                        <summary className="grid cursor-pointer list-none gap-3 py-4 marker:hidden sm:grid-cols-[170px_1fr_auto] sm:items-center"><div><p className="font-mono text-sm font-medium text-foreground">{entry.releaseLabel}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{safeDate(entry.deployedAt)}</p></div><p className="text-xs leading-5 text-muted-foreground">{entry.summary}</p><StatusBadge state={impactState} label={entry.impact.replace('-', ' ')} /></summary>
                        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-4">
                          {[
                            ['Latency before', metricValue(entry.latencyBeforeMs, ' ms')],
                            ['Latency after', metricValue(entry.latencyAfterMs, ' ms')],
                            ['5xx before', metricValue(entry.errorRateBeforePct, '%')],
                            ['5xx after', metricValue(entry.errorRateAfterPct, '%')],
                          ].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>)}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            </>
          ) : <EmptyState title="Release health is not available yet" description="A successful deploy and a telemetry window are required before Releasea can compare impact, evaluate SLOs, or advise on rollback." />}
        </TabsContent>
      </Tabs>
    </TabsContent>
  );
};
