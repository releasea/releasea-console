import type { Environment } from '@/types/releasea';
import type { Gateway, PublicationTargets } from './types';

export const LOG_LINE_LIMIT = 200;

export const frameworkOptions = [
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vite', label: 'Vite' },
  { value: 'astro', label: 'Astro' },
  { value: 'react', label: 'React SPA' },
];

export const ruleMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

export const INTERNAL_GATEWAY_DEFAULT = 'istio-system/releasea-internal-gateway';
export const EXTERNAL_GATEWAY_DEFAULT = 'istio-system/releasea-external-gateway';

export const isInternalGateway = (gateway: string): boolean => {
  const value = gateway.trim().toLowerCase();
  if (!value) return false;
  if (value === 'internal') return true;
  return value.includes('releasea-internal-gateway');
};

export const isExternalGateway = (gateway: string): boolean => {
  const value = gateway.trim().toLowerCase();
  if (!value) return false;
  if (value === 'external') return true;
  if (isInternalGateway(value)) return false;
  return true;
};

export const getGatewayTargets = (gateways: string[]): PublicationTargets => {
  let internal = false;
  let external = false;

  for (const gateway of gateways ?? []) {
    const normalized = gateway.trim().toLowerCase();
    if (normalized === 'mesh') {
      internal = true;
      continue;
    }
    if (isInternalGateway(gateway)) {
      internal = true;
      continue;
    }
    if (isExternalGateway(gateway)) {
      external = true;
    }
  }

  return { internal, external };
};

export const getPublicationLabel = ({ internal, external }: PublicationTargets) => {
  if (internal && external) return 'Internal + External';
  if (internal) return 'Internal only';
  if (external) return 'External only';
  return 'Not published';
};

export const buildGateways = (
  currentGateways: Gateway[] = [],
  targets: PublicationTargets,
  _environment?: Environment | string,
): string[] => {
  const internalGateway =
    currentGateways.find((gateway) => isInternalGateway(String(gateway))) ?? INTERNAL_GATEWAY_DEFAULT;
  const externalGateways = currentGateways.filter((gateway) => {
    const value = String(gateway);
    if (isInternalGateway(value)) return false;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'internal' || normalized === 'external' || normalized === 'mesh') return false;
    return normalized.length > 0;
  });

  const next: string[] = [];
  if (targets.internal) {
    next.push(internalGateway);
  }
  if (targets.external) {
    if (externalGateways.length > 0) {
      next.push(...externalGateways);
    } else {
      next.push(EXTERNAL_GATEWAY_DEFAULT);
    }
  }

  return Array.from(new Set(next));
};

export const methodBadgeClass = 'border-border/60 bg-muted/20 text-muted-foreground text-xs font-mono';
