import type { GovernanceSettings } from '@/types/governance';

export type GovernancePolicyPack = {
  id: string;
  label: string;
  description: string;
  environmentTiers: string[];
  settings: Pick<GovernanceSettings, 'deployApproval' | 'deployPolicy' | 'rulePublishApproval'>;
};

type DeployPolicyRule = GovernanceSettings['deployPolicy']['rules'][number];

const cloneRules = (rules: DeployPolicyRule[]): DeployPolicyRule[] =>
  rules.map((rule) => ({
    ...rule,
    allowedProfileIds: [...rule.allowedProfileIds],
    allowedScmProviders: [...rule.allowedScmProviders],
    allowedRegistryProviders: [...rule.allowedRegistryProviders],
    allowedSecretProviders: [...rule.allowedSecretProviders],
    allowedSourceTypes: [...rule.allowedSourceTypes],
    allowedRegistries: [...rule.allowedRegistries],
    allowedStrategies: [...rule.allowedStrategies],
  }));

export const GOVERNANCE_POLICY_PACKS: GovernancePolicyPack[] = [
  {
    id: 'startup-sandbox',
    label: 'Startup Sandbox',
    description: 'Fast iteration for dev and staging, with only lightweight control on production.',
    environmentTiers: ['dev', 'staging', 'prod'],
    settings: {
      deployApproval: {
        enabled: true,
        environments: ['prod'],
        minApprovers: 1,
      },
      deployPolicy: {
        enabled: true,
        dryRun: false,
        rules: [
          {
            environment: 'dev',
            allowAutoDeploy: true,
            requireExplicitVersion: false,
            blockExternalExposure: false,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['git', 'registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'canary'],
            maxReplicas: 0,
          },
          {
            environment: 'staging',
            allowAutoDeploy: true,
            requireExplicitVersion: true,
            blockExternalExposure: false,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['git', 'registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'canary'],
            maxReplicas: 6,
          },
          {
            environment: 'prod',
            allowAutoDeploy: false,
            requireExplicitVersion: true,
            blockExternalExposure: false,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'blue-green'],
            maxReplicas: 6,
          },
        ],
      },
      rulePublishApproval: {
        enabled: true,
        externalOnly: true,
        minApprovers: 1,
      },
    },
  },
  {
    id: 'balanced-delivery',
    label: 'Balanced Delivery',
    description: 'Adds stronger staging checks and keeps production pinned, reviewed, and mostly registry-driven.',
    environmentTiers: ['dev', 'staging', 'prod'],
    settings: {
      deployApproval: {
        enabled: true,
        environments: ['staging', 'prod'],
        minApprovers: 1,
      },
      deployPolicy: {
        enabled: true,
        dryRun: false,
        rules: [
          {
            environment: 'dev',
            allowAutoDeploy: true,
            requireExplicitVersion: false,
            blockExternalExposure: false,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['git', 'registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'canary'],
            maxReplicas: 4,
          },
          {
            environment: 'staging',
            allowAutoDeploy: false,
            requireExplicitVersion: true,
            blockExternalExposure: false,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['git', 'registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'canary', 'blue-green'],
            maxReplicas: 6,
          },
          {
            environment: 'prod',
            allowAutoDeploy: false,
            requireExplicitVersion: true,
            blockExternalExposure: true,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'blue-green'],
            maxReplicas: 8,
          },
        ],
      },
      rulePublishApproval: {
        enabled: true,
        externalOnly: true,
        minApprovers: 1,
      },
    },
  },
  {
    id: 'regulated-production',
    label: 'Regulated Production',
    description: 'Higher-friction approvals and tighter production boundaries for regulated or high-risk environments.',
    environmentTiers: ['staging', 'prod'],
    settings: {
      deployApproval: {
        enabled: true,
        environments: ['staging', 'prod'],
        minApprovers: 2,
      },
      deployPolicy: {
        enabled: true,
        dryRun: false,
        rules: [
          {
            environment: 'staging',
            allowAutoDeploy: false,
            requireExplicitVersion: true,
            blockExternalExposure: true,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'blue-green'],
            maxReplicas: 6,
          },
          {
            environment: 'prod',
            allowAutoDeploy: false,
            requireExplicitVersion: true,
            blockExternalExposure: true,
            allowedProfileIds: [],
            allowedScmProviders: [],
            allowedRegistryProviders: [],
            allowedSecretProviders: [],
            allowedSourceTypes: ['registry'],
            allowedRegistries: [],
            allowedStrategies: ['rolling', 'blue-green'],
            maxReplicas: 6,
          },
        ],
      },
      rulePublishApproval: {
        enabled: true,
        externalOnly: false,
        minApprovers: 2,
      },
    },
  },
];

export const applyGovernancePolicyPack = (
  current: GovernanceSettings,
  pack: GovernancePolicyPack,
): GovernanceSettings => ({
  ...current,
  deployApproval: {
    ...pack.settings.deployApproval,
    environments: [...pack.settings.deployApproval.environments],
  },
  deployPolicy: {
    ...pack.settings.deployPolicy,
    rules: cloneRules(pack.settings.deployPolicy.rules),
  },
  rulePublishApproval: {
    ...pack.settings.rulePublishApproval,
  },
});
