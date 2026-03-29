import type { DiscoveredEnvironmentVariable, DiscoveredProbe } from '@/types/releasea';
import type { RuntimeProfile } from '@/types/runtime-profile';

export const normalizeRepoName = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export const resolveGitBaseUrl = (provider?: string) => {
  const normalized = (provider || '').toLowerCase();
  if (normalized === 'gitlab') return 'https://gitlab.com';
  if (normalized === 'bitbucket') return 'https://bitbucket.org';
  return 'https://github.com';
};

export type RepositoryReference = {
  host: string;
  owner: string;
  name: string;
};

export const parseRepositoryReference = (value: string): RepositoryReference | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      host: sshMatch[1].toLowerCase(),
      owner: sshMatch[2],
      name: sshMatch[3].replace(/\.git$/i, ''),
    };
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const name = parts[1].replace(/\.git$/i, '');
    if (!owner || !name) return null;
    return {
      host: parsed.hostname.toLowerCase(),
      owner,
      name,
    };
  } catch {
    return null;
  }
};

export const normalizeRegistryHost = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return trimmed.replace(/^https?:\/\//, '').replace(/\/+$/, '');
};

export const resolveImageBase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lastColon = trimmed.lastIndexOf(':');
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastColon > lastSlash) {
    return trimmed.slice(0, lastColon);
  }
  return trimmed;
};

export const normalizeSecretValue = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('://')) return trimmed;
  return `secret://${trimmed}`;
};

export const joinContainerCommand = (command?: string[], args?: string[]) => {
  const parts = [...(command ?? []), ...(args ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  return parts.join(' ');
};

export const isImportableDiscoveredEnvVar = (variable: DiscoveredEnvironmentVariable) =>
  variable.importable !== false && (variable.sourceType ?? 'plain') === 'plain';

export const describeDiscoveredEnvVarSource = (variable: DiscoveredEnvironmentVariable) => {
  const sourceType = (variable.sourceType ?? '').trim();
  const reference = (variable.reference ?? '').trim();
  if (!sourceType || sourceType === 'plain') {
    return '';
  }
  if (reference) {
    return `${sourceType}: ${reference}`;
  }
  return sourceType;
};

export const describeDiscoveredProbe = (probe: DiscoveredProbe) => {
  const prefix = probe.containerName?.trim()
    ? `${probe.type} (${probe.containerName})`
    : probe.type;
  switch (probe.handler) {
    case 'httpGet':
      return `${prefix}: HTTP ${probe.path || '/'}${probe.port ? ` on ${probe.port}` : ''}`;
    case 'tcpSocket':
      return `${prefix}: TCP${probe.port ? ` on ${probe.port}` : ''}`;
    case 'grpc':
      return `${prefix}: gRPC${probe.port ? ` on ${probe.port}` : ''}${probe.service ? ` (${probe.service})` : ''}`;
    case 'exec':
      return `${prefix}: exec ${probe.command?.join(' ') || ''}`.trim();
    default:
      return `${prefix}: ${probe.handler}`;
  }
};

export const parseCpuMilli = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return 0;
  if (trimmed.endsWith('m')) {
    const parsed = Number.parseInt(trimmed.slice(0, -1), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 1000);
};

const MEMORY_SUFFIX_MULTIPLIER_MI: Record<string, number> = {
  '': 1 / (1024 * 1024),
  Ki: 1 / 1024,
  Mi: 1,
  Gi: 1024,
  Ti: 1024 * 1024,
  K: 1000 / (1024 * 1024),
  M: 1_000_000 / (1024 * 1024),
  G: 1_000_000_000 / (1024 * 1024),
  T: 1_000_000_000_000 / (1024 * 1024),
};

export const parseMemoryMi = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return 0;
  const suffix = ['Ki', 'Mi', 'Gi', 'Ti', 'K', 'M', 'G', 'T'].find((candidate) =>
    trimmed.endsWith(candidate),
  ) ?? '';
  const numericPart = suffix ? trimmed.slice(0, -suffix.length).trim() : trimmed;
  const parsed = Number.parseFloat(numericPart);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * (MEMORY_SUFFIX_MULTIPLIER_MI[suffix] ?? 0));
};

export const findMatchingRuntimeProfileId = (
  profiles: RuntimeProfile[],
  cpuMilli?: number,
  memoryMi?: number,
) => {
  const expectedCpu = typeof cpuMilli === 'number' && cpuMilli > 0 ? cpuMilli : 0;
  const expectedMemory = typeof memoryMi === 'number' && memoryMi > 0 ? memoryMi : 0;
  if (!expectedCpu && !expectedMemory) {
    return '';
  }

  const match = profiles.find((profile) => {
    const profileCpu = parseCpuMilli(profile.cpu);
    const profileMemory = parseMemoryMi(profile.memory);
    if (expectedCpu && profileCpu !== expectedCpu) {
      return false;
    }
    if (expectedMemory && profileMemory !== expectedMemory) {
      return false;
    }
    return true;
  });

  return match?.id ?? '';
};

export type RuntimeProfileRecommendationInput = {
  serviceType?: 'microservice' | 'static-site' | null;
  templateKind?: 'service' | 'scheduled-job';
  framework?: string;
  cpuMilli?: number;
  memoryMi?: number;
};

export type RuntimeProfileRecommendation = {
  profileId: string;
  reason: string;
  source: 'detected-workload' | 'blueprint-default';
};

const sortProfilesByCapacity = (profiles: RuntimeProfile[]) =>
  [...profiles].sort((left, right) => {
    const cpuDiff = parseCpuMilli(left.cpu) - parseCpuMilli(right.cpu);
    if (cpuDiff !== 0) return cpuDiff;
    return parseMemoryMi(left.memory) - parseMemoryMi(right.memory);
  });

const pickClosestRuntimeProfile = (
  profiles: RuntimeProfile[],
  targetCpuMilli: number,
  targetMemoryMi: number,
) => {
  const orderedProfiles = sortProfilesByCapacity(profiles);
  const directFit = orderedProfiles.find((profile) => {
    const profileCpuMilli = parseCpuMilli(profile.cpu);
    const profileMemoryMi = parseMemoryMi(profile.memory);
    return profileCpuMilli >= targetCpuMilli && profileMemoryMi >= targetMemoryMi;
  });
  if (directFit) {
    return directFit;
  }
  return orderedProfiles.at(-1) ?? null;
};

export const recommendRuntimeProfile = (
  profiles: RuntimeProfile[],
  input: RuntimeProfileRecommendationInput,
): RuntimeProfileRecommendation | null => {
  if (!profiles.length) return null;

  const detectedCpuMilli = typeof input.cpuMilli === 'number' && input.cpuMilli > 0 ? input.cpuMilli : 0;
  const detectedMemoryMi = typeof input.memoryMi === 'number' && input.memoryMi > 0 ? input.memoryMi : 0;
  if (detectedCpuMilli || detectedMemoryMi) {
    const exactMatchId = findMatchingRuntimeProfileId(profiles, detectedCpuMilli, detectedMemoryMi);
    if (exactMatchId) {
      return {
        profileId: exactMatchId,
        source: 'detected-workload',
        reason: `Matches the workload resources detected from the cluster import (${detectedCpuMilli || 'n/a'}m CPU, ${detectedMemoryMi || 'n/a'}Mi memory).`,
      };
    }
    const closestFit = pickClosestRuntimeProfile(profiles, detectedCpuMilli, detectedMemoryMi);
    if (closestFit) {
      return {
        profileId: closestFit.id,
        source: 'detected-workload',
        reason: `Closest fit for the workload resources detected from the cluster import (${detectedCpuMilli || 'n/a'}m CPU, ${detectedMemoryMi || 'n/a'}Mi memory).`,
      };
    }
  }

  const normalizedFramework = input.framework?.trim().toLowerCase() ?? '';
  let targetCpuMilli = 500;
  let targetMemoryMi = 512;
  let reason = 'Balanced default for service workloads.';

  if (input.templateKind === 'scheduled-job') {
    targetCpuMilli = 500;
    targetMemoryMi = 512;
    reason = 'Scheduled jobs usually need enough headroom for bursty batch execution.';
  } else if (input.serviceType === 'static-site') {
    if (normalizedFramework === 'nextjs') {
      targetCpuMilli = 500;
      targetMemoryMi = 512;
      reason = 'Next.js starters generally need a medium profile for build and runtime headroom.';
    } else {
      targetCpuMilli = 250;
      targetMemoryMi = 256;
      reason = 'Static site starters default to the smallest stable runtime profile.';
    }
  } else if (input.serviceType === 'microservice') {
    targetCpuMilli = 500;
    targetMemoryMi = 512;
    reason = 'Services and APIs default to a balanced runtime profile for safer first deploys.';
  }

  const recommended = pickClosestRuntimeProfile(profiles, targetCpuMilli, targetMemoryMi);
  if (!recommended) return null;
  return {
    profileId: recommended.id,
    source: 'blueprint-default',
    reason,
  };
};
