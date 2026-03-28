import type { DeployPolicyViolation } from '@/types/governance';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const extractDeployPolicyViolations = (value: unknown): DeployPolicyViolation[] => {
  if (!isRecord(value)) {
    return [];
  }

  const rawViolations = value.violations;
  if (!Array.isArray(rawViolations)) {
    return [];
  }

  return rawViolations.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const code = typeof entry.code === 'string' ? entry.code.trim() : '';
    const environment = typeof entry.environment === 'string' ? entry.environment.trim() : '';
    const message = typeof entry.message === 'string' ? entry.message.trim() : '';
    if (!code || !environment || !message) {
      return [];
    }

    const rule = isRecord(entry.rule) ? entry.rule : undefined;
    return [{ code, environment, message, rule }];
  });
};

export const summarizeDeployPolicyViolations = (violations: DeployPolicyViolation[]): string => {
  if (violations.length === 0) {
    return 'The requested deploy violates the configured governance policy.';
  }
  return violations.map((violation) => violation.message).join(' ');
};
