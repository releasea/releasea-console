import { describe, expect, it } from 'vitest';
import { redactSensitiveText } from '@/platform/security/data-security';

describe('redactSensitiveText', () => {
  it('masks IP addresses without corrupting timestamps', () => {
    const value = '2026/08/20 01:18:39 request from 127.0.0.1 and 2001:db8::1';
    const redacted = redactSensitiveText(value, { maskIPs: true });

    expect(redacted).toContain('01:18:39');
    expect(redacted).toContain('127.0.0.***');
    expect(redacted).not.toContain('2001:db8::1');
  });
});
