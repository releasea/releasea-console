import type { ManagementTransitionRequirement } from '@/pages/services/details/ManagementModeTransitionDialog';
import type { DeployPolicyPreflight } from '@/types/governance';
import type { Service, ServiceGitOpsDriftStatus, ServiceGitOpsRepositoryPolicyCheck } from '@/types/releasea';
import type { ReleaseIntelligenceSummary } from './release-intelligence';

export type ServiceReadinessItemState = 'ready' | 'review' | 'blocked';

export type ServiceReadinessItem = {
  id: string;
  label: string;
  state: ServiceReadinessItemState;
  message: string;
};

export type ServiceReadinessSection = {
  id: string;
  label: string;
  state: ServiceReadinessItemState;
  score: number;
  items: ServiceReadinessItem[];
};

export type ServiceReadinessScorecard = {
  score: number;
  state: ServiceReadinessItemState;
  sections: ServiceReadinessSection[];
};

const resolveSectionState = (items: ServiceReadinessItem[]): ServiceReadinessItemState => {
  if (items.some((item) => item.state === 'blocked')) return 'blocked';
  if (items.some((item) => item.state === 'review')) return 'review';
  return 'ready';
};

const resolveSectionScore = (items: ServiceReadinessItem[]) => {
  if (!items.length) return 100;
  const total = items.reduce((sum, item) => {
    if (item.state === 'ready') return sum + 100;
    if (item.state === 'review') return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / items.length);
};

const formatTelemetryMessage = (releaseIntelligence: ReleaseIntelligenceSummary | null): string => {
  if (!releaseIntelligence) {
    return 'Telemetry is not rich enough yet to score this service.';
  }

  const availability =
    releaseIntelligence.slo.availabilityPct == null
      ? 'availability unknown'
      : `availability ${releaseIntelligence.slo.availabilityPct}% against ${releaseIntelligence.slo.availabilityTargetPct}% target`;
  const latency =
    releaseIntelligence.slo.latencyP95AvgMs == null
      ? 'latency unknown'
      : `average p95 ${releaseIntelligence.slo.latencyP95AvgMs} ms against ${releaseIntelligence.slo.latencyTargetMs} ms target`;

  return `${availability}; ${latency}.`;
};

export const buildServiceReadinessScorecard = ({
  service,
  requirements,
  deployPolicyPreflight,
  gitOpsRepositoryPolicyCheck,
  gitOpsDrift,
  releaseIntelligence,
}: {
  service: Service;
  requirements: ManagementTransitionRequirement[];
  deployPolicyPreflight: DeployPolicyPreflight | null;
  gitOpsRepositoryPolicyCheck: ServiceGitOpsRepositoryPolicyCheck | null;
  gitOpsDrift: ServiceGitOpsDriftStatus | null;
  releaseIntelligence: ReleaseIntelligenceSummary | null;
}): ServiceReadinessScorecard => {
  // Mongo/Go serializes an uninitialized slice as null. Treat collection fields
  // from the API as empty here so a partially populated policy response cannot
  // take down the entire service details page.
  const policyViolations = Array.isArray(deployPolicyPreflight?.violations)
    ? deployPolicyPreflight.violations
    : [];
  const policyExceptions = Array.isArray(deployPolicyPreflight?.exceptionsApplied)
    ? deployPolicyPreflight.exceptionsApplied
    : [];
  const deliveryItems: ServiceReadinessItem[] = requirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    state: requirement.ready ? 'ready' : 'blocked',
    message: requirement.description,
  }));

  const governanceItems: ServiceReadinessItem[] = [
    {
      id: 'management-mode',
      label: 'Management mode',
      state: (service.managementMode ?? 'managed') === 'managed' ? 'ready' : 'review',
      message:
        (service.managementMode ?? 'managed') === 'managed'
          ? 'Releasea currently owns deploy control for this service.'
          : 'This service is still observed-only and deploy control is intentionally limited.',
    },
    {
      id: 'deploy-policy',
      label: 'Deploy policy',
      state:
        policyViolations.length > 0
          ? deployPolicyPreflight.dryRun
            ? 'review'
            : 'blocked'
          : policyExceptions.length > 0
            ? 'review'
          : 'ready',
      message:
        policyViolations.length > 0
          ? deployPolicyPreflight.dryRun
            ? `${policyViolations.length} policy warning(s) are being recorded in dry-run mode.`
            : `${policyViolations.length} policy blocker(s) currently prevent a clean deploy.`
          : policyExceptions.length > 0
            ? `${policyExceptions.length} temporary exception(s) are allowing deploys past active policy rules.`
          : 'No policy blockers are active for the selected environment.',
    },
  ];

  const gitOpsItems: ServiceReadinessItem[] = [
    {
      id: 'gitops-repository-policy',
      label: 'Repository policy',
      state:
        !service.repoUrl?.trim() || (service.managementMode ?? 'managed') === 'observed'
          ? 'review'
          : gitOpsRepositoryPolicyCheck?.status === 'invalid'
            ? 'blocked'
            : gitOpsRepositoryPolicyCheck?.status === 'needs-review'
              ? 'review'
              : 'ready',
      message:
        !service.repoUrl?.trim()
          ? 'GitOps repository policy checks are unavailable because the service does not point to a repository.'
          : (service.managementMode ?? 'managed') === 'observed'
            ? 'GitOps repository policy checks stay limited while the service is observed-only.'
            : gitOpsRepositoryPolicyCheck?.summary || 'Repository policy checks passed for GitOps delivery.',
    },
    {
      id: 'gitops',
      label: 'GitOps state',
      state:
        !service.repoUrl?.trim() || (service.managementMode ?? 'managed') === 'observed'
          ? 'review'
          : gitOpsDrift?.state === 'out-of-sync' || gitOpsDrift?.state === 'missing'
            ? 'review'
            : 'ready',
      message:
        !service.repoUrl?.trim()
          ? 'GitOps is not configured because the service does not point to a repository.'
          : (service.managementMode ?? 'managed') === 'observed'
            ? 'GitOps actions stay limited while the service is observed-only.'
            : gitOpsDrift?.message || 'GitOps desired state is aligned.',
    },
  ];

  const operationsItems: ServiceReadinessItem[] = [
    {
      id: 'telemetry',
      label: 'Release intelligence',
      state:
        !releaseIntelligence
          ? 'review'
          : releaseIntelligence.slo.overallState === 'breached'
            ? 'blocked'
            : releaseIntelligence.slo.overallState === 'at-risk'
              ? 'review'
              : 'ready',
      message:
        !releaseIntelligence
          ? 'Telemetry is not rich enough yet to score this service.'
          : formatTelemetryMessage(releaseIntelligence),
    },
    {
      id: 'rollback-confidence',
      label: 'Rollback confidence',
      state:
        !releaseIntelligence
          ? 'review'
          : releaseIntelligence.rollback.recommendation === 'rollback'
            ? 'blocked'
            : releaseIntelligence.rollback.recommendation === 'watch'
              ? 'review'
              : 'ready',
      message:
        !releaseIntelligence
          ? 'Rollback guidance will appear after deploy and telemetry history are available.'
          : releaseIntelligence.rollback.message,
    },
  ];

  const sections: ServiceReadinessSection[] = [
    { id: 'delivery', label: 'Delivery contract', items: deliveryItems, state: 'ready', score: 100 },
    { id: 'governance', label: 'Governance', items: governanceItems, state: 'ready', score: 100 },
    { id: 'gitops', label: 'GitOps', items: gitOpsItems, state: 'ready', score: 100 },
    { id: 'operations', label: 'Operations', items: operationsItems, state: 'ready', score: 100 },
  ].map((section) => ({
    ...section,
    state: resolveSectionState(section.items),
    score: resolveSectionScore(section.items),
  }));

  const overallScore = Math.round(sections.reduce((sum, section) => sum + section.score, 0) / sections.length);
  const overallState = resolveSectionState(
    sections.flatMap((section) => section.items),
  );

  return {
    score: overallScore,
    state: overallState,
    sections,
  };
};
