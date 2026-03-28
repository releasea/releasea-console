import type { DiscoveredWorkload } from '@/types/releasea';

export type AdoptionPreviewItemStatus = 'aligned' | 'changed' | 'missing' | 'warning';

export interface AdoptionPreviewItem {
  key: string;
  label: string;
  detected: string;
  current: string;
  status: AdoptionPreviewItemStatus;
  note?: string;
}

export interface AdoptionReadinessSummary {
  score: number;
  tone: 'ready' | 'caution' | 'manual';
  headline: string;
  blockers: string[];
  warnings: string[];
}

interface AdoptionCurrentState {
  serviceName: string;
  dockerImage: string;
  port: string;
  healthCheckPath: string;
  minReplicas: string;
  maxReplicas: string;
  profileId: string;
  profileLabel?: string;
  dockerCommand: string;
  scheduleCommand: string;
  scheduleCron: string;
  importedEnvCount: number;
}

const normalize = (value?: string | number | null) => String(value ?? '').trim();

const asReplicasLabel = (minReplicas: string, maxReplicas: string) => {
  const min = normalize(minReplicas);
  const max = normalize(maxReplicas);
  if (!min && !max) return '';
  if (min && max && min === max) return `${min}`;
  if (min && max) return `${min}-${max}`;
  return min || max;
};

const resolvePreviewStatus = (detected: string, current: string): AdoptionPreviewItemStatus => {
  if (!detected) return current ? 'changed' : 'missing';
  if (!current) return 'missing';
  return detected === current ? 'aligned' : 'changed';
};

export const buildAdoptionPreview = (
  workload: DiscoveredWorkload,
  current: AdoptionCurrentState,
  skippedEnvRefs: number,
  extraContainers: number,
): AdoptionPreviewItem[] => {
  const runtimeDetected =
    workload.cpuMilli || workload.memoryMi
      ? [
          workload.cpuMilli ? `${workload.cpuMilli}m CPU` : '',
          workload.memoryMi ? `${workload.memoryMi}Mi memory` : '',
        ]
          .filter(Boolean)
          .join(' / ')
      : '';

  const commandDetected =
    (workload.templateKind ?? 'service') === 'scheduled-job'
      ? normalize(workload.scheduleCron)
      : normalize([...(workload.command ?? []), ...(workload.args ?? [])].join(' '));

  const commandCurrent =
    (workload.templateKind ?? 'service') === 'scheduled-job'
      ? normalize(current.scheduleCron)
      : normalize(current.dockerCommand);

  const importableEnvCount = (workload.environmentVariables ?? []).filter(
    (variable) => variable.importable !== false && (variable.sourceType ?? 'plain') === 'plain',
  ).length;

  return [
    {
      key: 'name',
      label: 'Service name',
      detected: normalize(workload.name),
      current: normalize(current.serviceName),
      status: resolvePreviewStatus(normalize(workload.name), normalize(current.serviceName)),
    },
    {
      key: 'image',
      label: 'Container image',
      detected: normalize(workload.primaryImage ?? workload.images[0] ?? ''),
      current: normalize(current.dockerImage),
      status: resolvePreviewStatus(
        normalize(workload.primaryImage ?? workload.images[0] ?? ''),
        normalize(current.dockerImage),
      ),
    },
    {
      key: 'port',
      label: 'Port',
      detected: normalize(workload.port),
      current: normalize(current.port),
      status: resolvePreviewStatus(normalize(workload.port), normalize(current.port)),
    },
    {
      key: 'health',
      label: 'Health check',
      detected: normalize(workload.healthCheckPath),
      current: normalize(current.healthCheckPath),
      status: resolvePreviewStatus(normalize(workload.healthCheckPath), normalize(current.healthCheckPath)),
      note: workload.healthCheckPath ? 'Mapped from workload probe' : 'No HTTP probe path detected',
    },
    {
      key: 'replicas',
      label: 'Replicas',
      detected: workload.replicas ? String(workload.replicas) : '',
      current: asReplicasLabel(current.minReplicas, current.maxReplicas),
      status: resolvePreviewStatus(
        workload.replicas ? String(workload.replicas) : '',
        asReplicasLabel(current.minReplicas, current.maxReplicas),
      ),
    },
    {
      key: 'runtime',
      label: 'Runtime profile',
      detected: runtimeDetected,
      current: normalize(current.profileLabel ?? current.profileId),
      status: runtimeDetected
        ? current.profileId
          ? 'aligned'
          : 'missing'
        : current.profileId
          ? 'changed'
          : 'missing',
      note: runtimeDetected
        ? current.profileId
          ? 'Matched from detected resource requests'
          : 'No matching runtime profile was found automatically'
        : 'No resource requests detected in the workload',
    },
    {
      key: 'command',
      label: (workload.templateKind ?? 'service') === 'scheduled-job' ? 'Schedule' : 'Command',
      detected: commandDetected,
      current: commandCurrent,
      status: resolvePreviewStatus(commandDetected, commandCurrent),
    },
    {
      key: 'environment',
      label: 'Environment variables',
      detected: importableEnvCount ? `${importableEnvCount} importable` : '',
      current: current.importedEnvCount ? `${current.importedEnvCount} imported` : '',
      status:
        skippedEnvRefs > 0 || extraContainers > 0
          ? 'warning'
          : resolvePreviewStatus(
              importableEnvCount ? `${importableEnvCount}` : '',
              current.importedEnvCount ? `${current.importedEnvCount}` : '',
            ),
      note:
        skippedEnvRefs > 0
          ? `${skippedEnvRefs} cluster-native reference(s) still require manual recreation`
          : extraContainers > 0
            ? `${extraContainers} sidecar or companion container(s) were not imported`
            : 'Plain environment values imported into the service form',
    },
  ];
};

export const buildAdoptionReadiness = (
  workload: DiscoveredWorkload,
  current: AdoptionCurrentState,
  skippedEnvRefs: number,
  extraContainers: number,
): AdoptionReadinessSummary => {
  const checks = [
    {
      label: 'Detected image',
      passed: Boolean(normalize(workload.primaryImage ?? workload.images[0] ?? '')),
    },
    {
      label: 'Detected port',
      passed: Boolean(normalize(workload.port)),
    },
    {
      label: 'Health check mapped',
      passed: Boolean(normalize(current.healthCheckPath)),
    },
    {
      label: 'Replica baseline imported',
      passed: Boolean(normalize(current.minReplicas) || normalize(current.maxReplicas)),
    },
    {
      label: 'Runtime profile selected',
      passed:
        !(workload.cpuMilli || workload.memoryMi) || Boolean(normalize(current.profileId)),
    },
    {
      label: 'Command or schedule imported',
      passed:
        (workload.templateKind ?? 'service') === 'scheduled-job'
          ? Boolean(normalize(current.scheduleCron))
          : Boolean(normalize(current.dockerCommand)),
    },
    {
      label: 'Plain environment values imported',
      passed:
        (workload.environmentVariables ?? []).filter(
          (variable) => variable.importable !== false && (variable.sourceType ?? 'plain') === 'plain',
        ).length === 0 || current.importedEnvCount > 0,
    },
  ];

  const passedChecks = checks.filter((check) => check.passed).length;
  const baseScore = Math.round((passedChecks / checks.length) * 100);
  const penalty = skippedEnvRefs * 8 + extraContainers * 6;
  const score = Math.max(0, Math.min(100, baseScore - penalty));

  const blockers: string[] = [];
  if (!normalize(workload.primaryImage ?? workload.images[0] ?? '')) {
    blockers.push('No primary image was detected from the workload.');
  }
  if (!normalize(current.port)) {
    blockers.push('Port still needs manual review before managed adoption.');
  }
  if (!normalize(current.healthCheckPath)) {
    blockers.push('Health check path is still missing.');
  }
  if ((workload.cpuMilli || workload.memoryMi) && !normalize(current.profileId)) {
    blockers.push('No runtime profile matches the detected resource requests yet.');
  }

  const warnings: string[] = [];
  if (skippedEnvRefs > 0) {
    warnings.push(`${skippedEnvRefs} secret or configMap-backed environment reference(s) still need manual recreation.`);
  }
  if (extraContainers > 0) {
    warnings.push(`${extraContainers} additional container(s) were detected and are not managed by this service form.`);
  }

  const tone =
    blockers.length > 0 || score < 60 ? 'manual' : warnings.length > 0 || score < 85 ? 'caution' : 'ready';
  const headline =
    tone === 'ready'
      ? 'Ready for managed adoption'
      : tone === 'caution'
        ? 'Close, but review the imported runtime details'
        : 'Manual review is still required before managed adoption';

  return {
    score,
    tone,
    headline,
    blockers,
    warnings,
  };
};
