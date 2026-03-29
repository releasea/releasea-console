import { describe, expect, it } from 'vitest';
import { GOVERNANCE_POLICY_PACKS, applyGovernancePolicyPack } from '@/lib/governance-packs';
import type { GovernanceSettings } from '@/types/governance';

const baseSettings: GovernanceSettings = {
  deployApproval: {
    enabled: false,
    environments: [],
    minApprovers: 1,
  },
  deployPolicy: {
    enabled: false,
    dryRun: false,
    rules: [],
  },
  rulePublishApproval: {
    enabled: false,
    externalOnly: false,
    minApprovers: 1,
  },
  auditRetentionDays: 30,
};

describe('governance policy packs', () => {
  it('applyGovernancePolicyPack applies the selected tier pack while preserving unrelated settings', () => {
    const pack = GOVERNANCE_POLICY_PACKS.find((item) => item.id === 'balanced-delivery');
    expect(pack).toBeDefined();

    const result = applyGovernancePolicyPack(baseSettings, pack!);

    expect(result.auditRetentionDays).toBe(30);
    expect(result.deployApproval.enabled).toBe(true);
    expect(result.deployApproval.environments).toEqual(['staging', 'prod']);
    expect(result.deployPolicy.rules).toHaveLength(3);
    expect(result.rulePublishApproval.externalOnly).toBe(true);
  });
});
