import type { ProviderHealthCategory, ProviderStatusCategory } from '@/types/releasea';

export type OnboardingReadinessState = 'configured' | 'partial' | 'not-configured' | 'disabled';

export interface OnboardingReadinessSummary {
  state: OnboardingReadinessState;
  configuredProviders: number;
  partialProviders: number;
  message: string;
}

export interface FirstDeployGuideStep {
  id: 'platform' | 'project' | 'service' | 'deploy';
  title: string;
  description: string;
  complete: boolean;
}

export interface FirstDeployGuideState {
  steps: FirstDeployGuideStep[];
  currentStep: FirstDeployGuideStep;
  ctaHref?: string;
  ctaLabel: string;
  blockedByAdmin: boolean;
}

export function summarizeProviderReadiness(category?: ProviderStatusCategory): OnboardingReadinessSummary {
  const providers = category?.providers ?? [];
  const configuredProviders = providers.filter((provider) => provider.state === 'configured').length;
  const partialProviders = providers.filter((provider) => provider.state === 'partial').length;
  const defaultProvider = providers.find((provider) => provider.default);
  const configuredProvider = providers.find((provider) => provider.state === 'configured');
  const partialProvider = providers.find((provider) => provider.state === 'partial');

  if (configuredProviders > 0) {
    return {
      state: 'configured',
      configuredProviders,
      partialProviders,
      message:
        configuredProvider?.message ??
        defaultProvider?.message ??
        `${configuredProviders} provider${configuredProviders === 1 ? '' : 's'} configured.`,
    };
  }

  if (partialProviders > 0) {
    return {
      state: 'partial',
      configuredProviders,
      partialProviders,
      message:
        partialProvider?.message ??
        defaultProvider?.message ??
        'Configuration exists but still needs completion.',
    };
  }

  const enabledProviders = providers.filter((provider) => provider.state !== 'disabled').length;
  if (enabledProviders === 0 && providers.length > 0) {
    return {
      state: 'disabled',
      configuredProviders,
      partialProviders,
      message: 'This category is currently disabled.',
    };
  }

  return {
    state: 'not-configured',
    configuredProviders,
    partialProviders,
    message: defaultProvider?.message ?? 'No provider is configured yet.',
  };
}

export function summarizeProviderHealth(category?: ProviderHealthCategory): string {
  if (!category) {
    return 'Run live checks to validate connectivity and credentials.';
  }

  if (category.unhealthy > 0) {
    return `${category.unhealthy} live check${category.unhealthy === 1 ? '' : 's'} failed.`;
  }

  if (category.healthy > 0) {
    return `${category.healthy} live check${category.healthy === 1 ? '' : 's'} passed.`;
  }

  if ((category.unsupported ?? 0) > 0) {
    return 'Configured providers do not expose live readiness checks yet.';
  }

  if ((category.disabled ?? 0) > 0) {
    return 'Live checks are disabled for this provider category.';
  }

  return 'No live checks were run yet.';
}

interface ResolveFirstDeployGuideInput {
  isAdmin: boolean;
  hasScmCredentials: boolean;
  hasRegistryCredentials: boolean;
  hasOnlineWorker: boolean;
  projectCount: number;
  serviceCount: number;
  successfulDeployCount: number;
  firstProjectId?: string;
  firstServiceId?: string;
}

export function resolveFirstDeployGuide(input: ResolveFirstDeployGuideInput): FirstDeployGuideState {
  const platformReady = input.hasScmCredentials && input.hasRegistryCredentials && input.hasOnlineWorker;
  const serviceHref = input.firstProjectId ? `/services/new?project=${input.firstProjectId}` : '/services/new';
  const deployHref = input.firstServiceId ? `/services/${input.firstServiceId}?action=deploy` : serviceHref;

  const steps: FirstDeployGuideStep[] = [
    {
      id: 'platform',
      title: 'Platform prerequisites',
      description: 'SCM, registry, and at least one worker must be ready before the first deploy.',
      complete: platformReady,
    },
    {
      id: 'project',
      title: 'Project ready',
      description: 'Create the first project so services can inherit ownership and credentials.',
      complete: input.projectCount > 0,
    },
    {
      id: 'service',
      title: 'Service created or adopted',
      description: 'Create a new service from a template or adopt an existing workload from the cluster.',
      complete: input.serviceCount > 0,
    },
    {
      id: 'deploy',
      title: 'First deploy completed',
      description: 'Queue the first deploy and confirm the platform can build, schedule, and run it end to end.',
      complete: input.successfulDeployCount > 0,
    },
  ];

  const currentStep = steps.find((step) => !step.complete) ?? steps[steps.length - 1];

  if (!platformReady) {
    return {
      steps,
      currentStep,
      ctaHref: input.isAdmin ? '/settings?tab=credentials' : undefined,
      ctaLabel: input.isAdmin ? 'Finish platform setup' : 'Waiting on admin setup',
      blockedByAdmin: !input.isAdmin,
    };
  }

  if (input.projectCount === 0) {
    return {
      steps,
      currentStep,
      ctaHref: '/projects?action=create',
      ctaLabel: 'Create project',
      blockedByAdmin: false,
    };
  }

  if (input.serviceCount === 0) {
    return {
      steps,
      currentStep,
      ctaHref: serviceHref,
      ctaLabel: 'Create first service',
      blockedByAdmin: false,
    };
  }

  if (input.successfulDeployCount === 0) {
    return {
      steps,
      currentStep,
      ctaHref: deployHref,
      ctaLabel: input.firstServiceId ? 'Open guided deploy' : 'Create first service',
      blockedByAdmin: false,
    };
  }

  return {
    steps,
    currentStep,
    ctaHref: input.firstServiceId ? `/services/${input.firstServiceId}` : undefined,
    ctaLabel: 'Open service',
    blockedByAdmin: false,
  };
}
