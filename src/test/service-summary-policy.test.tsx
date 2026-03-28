import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { SummaryTab } from '@/pages/services/details/tabs/SummaryTab';
import type { Service } from '@/types/releasea';

const serviceFixture: Service = {
  id: 'svc-1',
  name: 'checkout-api',
  type: 'microservice',
  status: 'healthy',
  projectId: 'proj-1',
  replicas: 2,
  cpu: 500,
  memory: 512,
  createdAt: '2026-03-28T10:00:00Z',
  environment: {},
  ruleIds: [],
};

describe('SummaryTab deploy policy preflight', () => {
  it('renders policy preflight blockers when violations are present', () => {
    render(
      <Tabs value="summary">
        <SummaryTab
          service={serviceFixture}
          serviceTypeLabel="Microservice"
          runtimeLabel="Standard"
          isServiceActive
          instanceLabel="2 replicas"
          viewEnvLabel="Production"
          displayStatus="healthy"
          repositoryUrl="https://github.com/releasea/checkout-api"
          dockerImageLabel={null}
          branchName="main"
          dockerfileLabel="Dockerfile"
          dockerContextLabel="."
          envCountLabel="0 vars"
          healthPath="/health"
          appUrls={[]}
          deployPolicyPreflight={{
            environment: 'prod',
            trigger: 'manual',
            sourceType: 'registry',
            registryHost: 'docker.io',
            strategyType: 'rolling',
            replicas: 2,
            explicitVersion: false,
            target: {},
            violations: [
              {
                code: 'explicit-version-required',
                environment: 'prod',
                message: 'Version pinning is required in production.',
              },
            ],
          }}
          deployPolicyPreflightLoading={false}
          deployBusy={false}
          deployDisabled={false}
          onDeployLatest={() => {}}
          onOpenVersionPicker={() => {}}
          cpuAvgLabel="20%"
          cpuPeakLabel="40%"
          memoryAvgLabel="200 MiB"
          memoryPeakLabel="260 MiB"
          latencyAvgLabel="40 ms"
          latencyPeakLabel="90 ms"
          requestsAvgLabel="20 rpm"
          requestsPeakLabel="120 rpm"
          releaseIntelligence={null}
        />
      </Tabs>,
    );

    expect(screen.getByText(/deploy policy preflight has blockers/i)).toBeInTheDocument();
    expect(screen.getByText(/version pinning is required in production/i)).toBeInTheDocument();
  });
});
