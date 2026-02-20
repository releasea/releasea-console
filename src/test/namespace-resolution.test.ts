import { describe, it, expect } from 'vitest';
import {
  resolveNamespace,
  environmentsShareNamespace,
  NAMESPACE_PRODUCTION,
  NAMESPACE_STAGING,
  NAMESPACE_DEVELOPMENT,
  NAMESPACE_SYSTEM,
} from '@/lib/environments';

describe('resolveNamespace', () => {
  it('maps production-like environments to releasea-apps-production', () => {
    expect(resolveNamespace('prod')).toBe(NAMESPACE_PRODUCTION);
    expect(resolveNamespace('production')).toBe(NAMESPACE_PRODUCTION);
    expect(resolveNamespace('live')).toBe(NAMESPACE_PRODUCTION);
  });

  it('maps staging-like environments to releasea-apps-staging', () => {
    expect(resolveNamespace('staging')).toBe(NAMESPACE_STAGING);
    expect(resolveNamespace('stage')).toBe(NAMESPACE_STAGING);
    expect(resolveNamespace('uat')).toBe(NAMESPACE_STAGING);
    expect(resolveNamespace('pre-prod')).toBe(NAMESPACE_STAGING);
    expect(resolveNamespace('preprod')).toBe(NAMESPACE_STAGING);
  });

  it('maps development-like environments to releasea-apps-development', () => {
    expect(resolveNamespace('dev')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('development')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('qa')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('sandbox')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('test')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('preview')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('feature')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('ci')).toBe(NAMESPACE_DEVELOPMENT);
  });

  it('defaults empty environment to releasea-apps-production', () => {
    expect(resolveNamespace('')).toBe(NAMESPACE_PRODUCTION);
  });

  it('defaults unknown environments to releasea-apps-development', () => {
    expect(resolveNamespace('custom-env')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('experiment')).toBe(NAMESPACE_DEVELOPMENT);
    expect(resolveNamespace('perf')).toBe(NAMESPACE_DEVELOPMENT);
  });

  it('is case-insensitive', () => {
    expect(resolveNamespace('PROD')).toBe(NAMESPACE_PRODUCTION);
    expect(resolveNamespace('Staging')).toBe(NAMESPACE_STAGING);
    expect(resolveNamespace('DEV')).toBe(NAMESPACE_DEVELOPMENT);
  });

  it('never returns releasea-system', () => {
    const envs = ['prod', 'staging', 'dev', '', 'releasea-system', 'system', 'qa', 'uat'];
    for (const env of envs) {
      expect(resolveNamespace(env)).not.toBe(NAMESPACE_SYSTEM);
    }
  });

  it('only returns one of three fixed namespaces', () => {
    const valid = new Set([NAMESPACE_PRODUCTION, NAMESPACE_STAGING, NAMESPACE_DEVELOPMENT]);
    const envs = ['prod', 'staging', 'dev', 'qa', 'uat', 'sandbox', 'custom', '', 'live', 'ci'];
    for (const env of envs) {
      expect(valid.has(resolveNamespace(env))).toBe(true);
    }
  });
});

describe('environmentsShareNamespace', () => {
  it('returns true for environments in the same tier', () => {
    expect(environmentsShareNamespace('prod', 'production')).toBe(true);
    expect(environmentsShareNamespace('prod', 'live')).toBe(true);
    expect(environmentsShareNamespace('dev', 'qa')).toBe(true);
    expect(environmentsShareNamespace('dev', 'sandbox')).toBe(true);
    expect(environmentsShareNamespace('staging', 'uat')).toBe(true);
  });

  it('returns false for environments in different tiers', () => {
    expect(environmentsShareNamespace('prod', 'staging')).toBe(false);
    expect(environmentsShareNamespace('prod', 'dev')).toBe(false);
    expect(environmentsShareNamespace('staging', 'dev')).toBe(false);
  });
});
