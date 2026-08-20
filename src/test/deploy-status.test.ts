import { describe, expect, it } from 'vitest';
import {
  isDeployActionBlockedStatus,
  isFailedDeployStatus,
  isLiveDeployStatus,
  normalizeDeployStatusValue,
} from '@/lib/deploy-status';

describe('deploy status lifecycle', () => {
  it.each([
    'requested',
    'scheduled',
    'preparing',
    'deploying',
    'validating',
    'progressing',
    'promoting',
    'retrying',
    'rolling-back',
  ])('blocks another deploy while %s is active', (status) => {
    expect(isDeployActionBlockedStatus(status)).toBe(true);
    expect(isLiveDeployStatus(status)).toBe(true);
  });

  it('distinguishes rollback execution from its terminal outcome', () => {
    expect(isLiveDeployStatus('rolling-back')).toBe(true);
    expect(isFailedDeployStatus('rolling-back')).toBe(false);
    expect(isLiveDeployStatus('rolled-back')).toBe(false);
    expect(isFailedDeployStatus('rolled-back')).toBe(true);
  });

  it('normalizes legacy rollback records to the terminal outcome', () => {
    expect(normalizeDeployStatusValue('rollback')).toBe('rolled-back');
  });
});
