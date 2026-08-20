import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { AssistantTab } from '@/pages/services/details/tabs/AssistantTab';

const fetchServiceAIAnalyses = vi.fn();
const createServiceAIAnalysis = vi.fn();

vi.mock('@/lib/data', () => ({
  fetchServiceAIAnalyses: (...args: unknown[]) => fetchServiceAIAnalyses(...args),
  createServiceAIAnalysis: (...args: unknown[]) => createServiceAIAnalysis(...args),
}));

describe('AssistantTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchServiceAIAnalyses.mockResolvedValue([]);
  });

  it('runs a read-only analysis for the selected environment', async () => {
    createServiceAIAnalysis.mockResolvedValue({
      id: 'aia-1',
      serviceId: 'svc-1',
      kind: 'failed-deploy',
      status: 'completed',
      providerId: 'aip-1',
      result: { summary: 'Readiness probe failed', severity: 'warning', findings: [], recommendations: [], limitations: [] },
      createdAt: new Date().toISOString(),
    });
    fetchServiceAIAnalyses
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'aia-1', serviceId: 'svc-1', kind: 'failed-deploy', status: 'completed', providerId: 'aip-1', result: { summary: 'Readiness probe failed', severity: 'warning', findings: [], recommendations: [], limitations: [] }, createdAt: new Date().toISOString() }]);

    render(<Tabs value="assistant"><AssistantTab serviceId="svc-1" environment="prod" providers={[{ id: 'aip-1', name: 'Primary', type: 'openai', model: 'gpt-5.6-luna', default: true }]} /></Tabs>);
    await screen.findByRole('combobox', { name: /ai provider/i });
    fireEvent.click(screen.getByRole('button', { name: /explain failed deploy/i }));
    fireEvent.change(screen.getByPlaceholderText(/optional: add a specific question/i), { target: { value: 'What changed?' } });
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));

    await waitFor(() => expect(createServiceAIAnalysis).toHaveBeenCalledWith('svc-1', {
      kind: 'failed-deploy',
      providerId: 'aip-1',
      question: 'What changed?',
      environment: 'prod',
    }));
    expect((await screen.findAllByText('Readiness probe failed')).length).toBeGreaterThan(0);
  });

  it('disables analysis when no provider is available', async () => {
    render(<Tabs value="assistant"><AssistantTab serviceId="svc-1" environment="prod" providers={[]} /></Tabs>);
    expect(await screen.findByText(/no enabled provider is available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run analysis/i })).toBeDisabled();
  });
});
