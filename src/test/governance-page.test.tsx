import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GovernancePage from '@/pages/governance/GovernancePage';

const fetchApprovalRequests = vi.fn();
const fetchGovernanceSettings = vi.fn();
const fetchAuditLogs = vi.fn();
const updateGovernanceSettings = vi.fn();
const reviewApproval = vi.fn();
const toast = vi.fn();

vi.mock('@/lib/governance-data', () => ({
  buildGovernancePolicyDocument: (settings: unknown) => ({
    kind: 'releasea.governance.policy',
    apiVersion: 'v1',
    exportedAt: '2026-03-28T12:00:00Z',
    spec: settings,
  }),
  fetchApprovalRequests: (...args: unknown[]) => fetchApprovalRequests(...args),
  fetchGovernanceSettings: (...args: unknown[]) => fetchGovernanceSettings(...args),
  fetchAuditLogs: (...args: unknown[]) => fetchAuditLogs(...args),
  updateGovernanceSettings: (...args: unknown[]) => updateGovernanceSettings(...args),
  reviewApproval: (...args: unknown[]) => reviewApproval(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/ListPageHeader', () => ({
  ListPageHeader: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

const governanceSettingsFixture = {
  deployApproval: {
    enabled: false,
    environments: ['prod'],
    minApprovers: 1,
  },
  deployPolicy: {
    enabled: false,
    rules: [],
  },
  rulePublishApproval: {
    enabled: false,
    externalOnly: false,
    minApprovers: 1,
  },
  auditRetentionDays: 30,
};

describe('GovernancePage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <GovernancePage />
      </MemoryRouter>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    fetchApprovalRequests.mockResolvedValue([]);
    fetchGovernanceSettings.mockResolvedValue(governanceSettingsFixture);
    fetchAuditLogs.mockResolvedValue([]);
    updateGovernanceSettings.mockImplementation(async (settings) => settings);
    reviewApproval.mockResolvedValue(true);
  });

  it('shows a default rule immediately when deploy policy is enabled', async () => {
    renderPage();

    const policiesTab = await screen.findByRole('tab', { name: /policies/i });
    fireEvent.mouseDown(policiesTab);
    fireEvent.click(policiesTab);
    await screen.findByText('Enable deploy policy');

    const policyToggleRow = screen.getByText('Enable deploy policy').closest('div');
    if (!policyToggleRow) {
      throw new Error('Enable deploy policy row not found');
    }
    const policySwitch = within(policyToggleRow.parentElement as HTMLElement).getByRole('switch');
    fireEvent.click(policySwitch);

    expect(await screen.findByText('Rule 1')).toBeInTheDocument();
    expect(screen.getByText('Policy rules')).toBeInTheDocument();
  });

  it('refreshes audit logs after saving governance settings', async () => {
    fetchAuditLogs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'gaudit-1',
          action: 'governance.settings.updated',
          resourceType: 'settings',
          resourceId: 'governance-settings',
          resourceName: 'Governance Settings',
          performedBy: { id: 'usr-1', name: 'Admin User', email: 'admin@releasea.io' },
          performedAt: '2026-03-28T12:00:00Z',
          details: { section: 'deployPolicy' },
        },
      ]);

    renderPage();

    const policiesTab = await screen.findByRole('tab', { name: /policies/i });
    fireEvent.mouseDown(policiesTab);
    fireEvent.click(policiesTab);
    await screen.findByText('Enable deploy policy');

    const saveButton = await screen.findByRole('button', { name: /save policies/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateGovernanceSettings).toHaveBeenCalledTimes(1);
      expect(fetchAuditLogs).toHaveBeenCalledTimes(2);
    });

    const auditTab = screen.getByRole('tab', { name: /audit log/i });
    fireEvent.mouseDown(auditTab);
    fireEvent.click(auditTab);

    expect(await screen.findByText(/governance settings updated/i)).toBeInTheDocument();
    expect(screen.getByText(/admin user/i)).toBeInTheDocument();
  });

  it('renders platform audit events in the audit tab', async () => {
    fetchAuditLogs.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'deploy.queued',
        resourceType: 'deploy',
        resourceId: 'deploy-1',
        resourceName: 'Checkout API',
        performedBy: { id: 'usr-1', name: 'Developer User', email: 'dev@releasea.io' },
        performedAt: '2026-03-28T12:00:00Z',
        details: { environment: 'prod', operationId: 'op-1' },
      },
    ]);

    renderPage();

    const auditTab = await screen.findByRole('tab', { name: /audit log/i });
    fireEvent.mouseDown(auditTab);
    fireEvent.click(auditTab);

    expect(await screen.findByText(/deploy queued/i)).toBeInTheDocument();
    expect(screen.getByText(/checkout api/i)).toBeInTheDocument();
    expect(screen.getByText(/developer user/i)).toBeInTheDocument();
  });
});
