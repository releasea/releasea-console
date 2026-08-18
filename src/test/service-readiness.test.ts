import { describe, expect, it } from 'vitest';
import { buildServiceReadinessScorecard } from '@/lib/service-readiness';
import type { Service, ServiceGitOpsDriftStatus, ServiceGitOpsRepositoryPolicyCheck } from '@/types/releasea';
import type { DeployPolicyPreflight } from '@/types/governance';
import type { ReleaseIntelligenceSummary } from '@/lib/release-intelligence';
import type { ManagementTransitionRequirement } from '@/pages/services/details/ManagementModeTransitionDialog';

const baseService: Service = {
  id: 'svc-1',
  name: 'payments',
  type: 'microservice',
  status: 'running',
  projectId: 'proj-1',
  replicas: 2,
  cpu: 50,
  memory: 128,
  createdAt: '2026-01-01T00:00:00Z',
  environment: {},
  ruleIds: [],
  repoUrl: 'https://github.com/acme/payments',
  managementMode: 'managed',
};

const readyRequirements: ManagementTransitionRequirement[] = [
  { id: 'worker', label: 'Worker', description: 'worker is online', ready: true },
  { id: 'repo-url', label: 'Repository configured', description: 'repo exists', ready: true },
];

const cleanPolicy: DeployPolicyPreflight = {
  environment: 'dev',
  trigger: 'deploy',
  sourceType: 'git',
  strategyType: 'rolling',
  replicas: 2,
  explicitVersion: true,
  target: {},
  violations: [],
};

const inSyncDrift: ServiceGitOpsDriftStatus = {
  state: 'in-sync',
  inSync: true,
  message: 'Desired state is aligned.',
  repoUrl: 'https://github.com/acme/payments',
  baseBranch: 'main',
  filePath: '.releasea/gitops/payments.desired-state.yaml',
  expectedHash: 'abc',
};

const verifiedRepositoryPolicy: ServiceGitOpsRepositoryPolicyCheck = {
  status: 'verified',
  summary: 'GitOps repository policy checks passed for github on branch main.',
  repoUrl: 'https://github.com/acme/payments',
  baseBranch: 'main',
  provider: 'github',
  checks: [],
};

const healthyRelease: ReleaseIntelligenceSummary = {
  slo: {
    overallState: 'meeting',
    summary: 'SLOs are currently within target.',
    availabilityPercent: 99.95,
    latencyP95Ms: 180,
    errorRatePercent: 0.2,
  },
  comparison: {
    latestVersion: '1.2.3',
    previousVersion: '1.2.2',
    summary: 'Latest release is stable versus the previous release.',
    requestDeltaPercent: 5,
    latencyDeltaPercent: -2,
    errorRateDeltaPercent: -0.1,
  },
  rollback: {
    recommendation: 'stable',
    summary: 'No rollback signal detected from current telemetry.',
  },
};

describe('buildServiceReadinessScorecard', () => {
  it('returns a ready scorecard for a well-configured managed service', () => {
    const scorecard = buildServiceReadinessScorecard({
      service: baseService,
      requirements: readyRequirements,
      deployPolicyPreflight: cleanPolicy,
      gitOpsRepositoryPolicyCheck: verifiedRepositoryPolicy,
      gitOpsDrift: inSyncDrift,
      releaseIntelligence: healthyRelease,
    });

    expect(scorecard.state).toBe('ready');
    expect(scorecard.score).toBeGreaterThanOrEqual(90);
  });

  it('flags blocked state when delivery or governance blockers exist', () => {
    const scorecard = buildServiceReadinessScorecard({
      service: { ...baseService, managementMode: 'observed' },
      requirements: [
        { id: 'worker', label: 'Worker', description: 'missing worker', ready: false },
      ],
      deployPolicyPreflight: {
        ...cleanPolicy,
        violations: [{ code: 'blocked', environment: 'dev', message: 'Blocked by policy' }],
      },
      gitOpsRepositoryPolicyCheck: {
        ...verifiedRepositoryPolicy,
        status: 'invalid',
        summary: 'GitOps repository policy checks found 1 blocking issue.',
      },
      gitOpsDrift: { ...inSyncDrift, state: 'out-of-sync', inSync: false, message: 'Drift detected' },
      releaseIntelligence: healthyRelease,
    });

    expect(scorecard.state).toBe('blocked');
    expect(scorecard.sections.find((section) => section.id === 'delivery')?.state).toBe('blocked');
    expect(scorecard.sections.find((section) => section.id === 'governance')?.state).toBe('blocked');
  });

  it('treats null policy collections returned by the API as empty', () => {
    const scorecard = buildServiceReadinessScorecard({
      service: { ...baseService, managementMode: 'observed' },
      requirements: readyRequirements,
      deployPolicyPreflight: {
        ...cleanPolicy,
        violations: null,
        exceptionsApplied: null,
      } as unknown as DeployPolicyPreflight,
      gitOpsRepositoryPolicyCheck: verifiedRepositoryPolicy,
      gitOpsDrift: inSyncDrift,
      releaseIntelligence: healthyRelease,
    });

    expect(scorecard.state).toBe('review');
    expect(scorecard.sections.find((section) => section.id === 'governance')?.state).toBe('review');
  });
});
