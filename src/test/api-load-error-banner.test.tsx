import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiLoadErrorBanner } from '@/components/layout/ApiLoadErrorBanner';
import { reportApiLoadFailure, reportApiLoadRecovery } from '@/platform/http/api-feedback';

describe('ApiLoadErrorBanner', () => {
  afterEach(() => reportApiLoadRecovery('fetchServices'));

  it('distinguishes a loading failure from a legitimate empty state', () => {
    render(<ApiLoadErrorBanner />);
    act(() => reportApiLoadFailure('fetchServices', 'Network unavailable'));

    expect(screen.getByRole('alert')).toHaveTextContent('Some platform data could not be loaded');
    expect(screen.getByRole('alert')).toHaveTextContent('fetchServices');
    fireEvent.click(screen.getByRole('button', { name: /dismiss data loading warning/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
