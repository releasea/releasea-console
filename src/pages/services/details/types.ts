import type { ManagedRule } from '@/types/releasea';
import type { EnvVar } from '@/forms/types';

export type { EnvVar };

export type ServiceDetailsLocationState = {
  from?: {
    pathname: string;
    label?: string;
  };
};

export type RuleRow = ManagedRule & { serviceName?: string };

export type PublicationTargets = {
  internal: boolean;
  external: boolean;
};

export type Gateway = 'internal' | 'external' | string;
