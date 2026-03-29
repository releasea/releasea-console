import { describe, expect, it } from 'vitest';

describe('governance data helpers', () => {
  it('builds a versioned governance policy document', async () => {
    const { buildGovernancePolicyDocument } = await import('@/lib/governance-data');

    const document = buildGovernancePolicyDocument(
      {
        deployApproval: { enabled: true, environments: ['prod'], minApprovers: 2 },
        deployPolicy: {
          enabled: true,
          dryRun: false,
          rules: [
            {
              environment: 'prod',
              allowAutoDeploy: false,
              requireExplicitVersion: true,
              blockExternalExposure: true,
              allowedProfileIds: ['rp-medium'],
              allowedScmProviders: ['github'],
              allowedRegistryProviders: ['ghcr'],
              allowedSecretProviders: ['vault'],
              allowedSourceTypes: ['registry'],
              allowedRegistries: ['ghcr.io'],
              allowedStrategies: ['rolling'],
              maxReplicas: 3,
            },
          ],
        },
        rulePublishApproval: { enabled: true, externalOnly: true, minApprovers: 1 },
        auditRetentionDays: 30,
      },
      '2026-03-28T12:00:00Z',
    );

    expect(document.kind).toBe('releasea.governance.policy');
    expect(document.apiVersion).toBe('v1');
    expect(document.exportedAt).toBe('2026-03-28T12:00:00Z');
    expect(document.spec.deployPolicy.rules[0]?.allowedRegistries).toEqual(['ghcr.io']);
    expect(document.spec.deployPolicy.rules[0]?.allowedProfileIds).toEqual(['rp-medium']);
  });
});
