import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { DeliveryTab } from '@/pages/services/details/tabs/DeliveryTab';
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

describe('DeliveryTab deploy policy preflight', () => {
  it('renders policy preflight blockers when violations are present', () => {
    render(
      <Tabs value="delivery">
        <DeliveryTab
          service={serviceFixture}
          viewEnvLabel="Production"
          managementTransitionRequirements={[]}
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
          gitOpsDrift={null}
          gitOpsDriftLoading={false}
          desiredStateValidation={null}
          desiredStateValidationLoading={false}
          releaseIntelligence={null}
        />
      </Tabs>,
    );

    expect(screen.getByText(/current blockers/i)).toBeInTheDocument();
    expect(screen.getByText(/version pinning is required in production/i)).toBeInTheDocument();
  });
});
