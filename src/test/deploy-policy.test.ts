import { describe, expect, it, vi } from 'vitest';

describe('deploy policy helpers', () => {
  it('extracts deploy policy violations from an API error body', async () => {
    const { extractDeployPolicyViolations } = await import('@/lib/deploy-policy');

    const violations = extractDeployPolicyViolations({
      code: 'GOVERNANCE_DEPLOY_POLICY_VIOLATION',
      violations: [
        {
          code: 'strategy-not-allowed',
          environment: 'prod',
          message: 'Strategy canary is not allowed by policy for environment prod.',
        },
      ],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.code).toBe('strategy-not-allowed');
    expect(violations[0]?.environment).toBe('prod');
  });

  it('returns promote canary violations when the API rejects the action', async () => {
    const { promoteCanary } = await import('@/lib/data');
    const apiClient = await import('@/lib/api-client');
    const postSpy = vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      data: null,
      error: 'Strategy canary is not allowed by policy for environment prod.',
      errorBody: {
        code: 'GOVERNANCE_DEPLOY_POLICY_VIOLATION',
        violations: [
          {
            code: 'strategy-not-allowed',
            environment: 'prod',
            message: 'Strategy canary is not allowed by policy for environment prod.',
          },
        ],
      },
      status: 409,
    });

    const result = await promoteCanary('svc-1', 'prod');
    expect(result.error).toContain('not allowed');
    expect(result.violations).toHaveLength(1);
    expect(result.violations?.[0]?.code).toBe('strategy-not-allowed');

    postSpy.mockRestore();
  });

  it('returns rule publish violations when external exposure is blocked', async () => {
    const { publishRuleTargets } = await import('@/lib/data');
    const apiClient = await import('@/lib/api-client');
    const postSpy = vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      data: null,
      error: 'External exposure is blocked by policy for environment prod.',
      errorBody: {
        code: 'GOVERNANCE_EXPOSURE_POLICY_VIOLATION',
        violations: [
          {
            code: 'external-exposure-disabled',
            environment: 'prod',
            message: 'External exposure is blocked by policy for environment prod.',
          },
        ],
      },
      status: 409,
    });

    const result = await publishRuleTargets('rule-1', {
      internal: false,
      external: true,
      environment: 'prod',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('blocked');
    expect(result.violations).toHaveLength(1);
    expect(result.violations?.[0]?.code).toBe('external-exposure-disabled');

    postSpy.mockRestore();
  });

  it('loads rule publish policy preflight for the selected targets', async () => {
    const { fetchRulePublishPolicyCheck } = await import('@/lib/data');
    const apiClient = await import('@/lib/api-client');
    const getSpy = vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      data: {
        environment: 'prod',
        internal: false,
        external: true,
        violations: [
          {
            code: 'external-exposure-disabled',
            environment: 'prod',
            message: 'External exposure is blocked by policy for environment prod.',
          },
        ],
      },
      error: null,
      errorBody: null,
      status: 200,
    });

    const result = await fetchRulePublishPolicyCheck('rule-1', {
      environment: 'prod',
      internal: false,
      external: true,
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/rules/rule-1/publish-policy-check?environment=prod&external=true',
      expect.anything(),
    );
    expect(result?.violations).toHaveLength(1);
    expect(result?.violations[0]?.code).toBe('external-exposure-disabled');

    getSpy.mockRestore();
  });
});
