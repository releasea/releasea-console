import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIProvidersSettings } from '@/pages/settings/AIProvidersSettings';

const fetchAIProviders = vi.fn();
const fetchAIUsage = vi.fn();

vi.mock('@/lib/data', () => ({
  fetchAIProviders: (...args: unknown[]) => fetchAIProviders(...args),
  fetchAIUsage: (...args: unknown[]) => fetchAIUsage(...args),
  createAIProvider: vi.fn(),
  updateAIProvider: vi.fn(),
  deleteAIProvider: vi.fn(),
  testAIProvider: vi.fn(),
}));

describe('AIProvidersSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAIProviders.mockResolvedValue([]);
    fetchAIUsage.mockResolvedValue({ from: '', providers: [] });
  });

  it('keeps provider configuration in a focused modal', async () => {
    render(<AIProvidersSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add AI provider' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add AI provider' });
    expect(within(dialog).getByLabelText('Name')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add provider' })).toBeInTheDocument();
    expect(screen.getByText('Usage (last 30 days)')).toBeInTheDocument();
  });
});
