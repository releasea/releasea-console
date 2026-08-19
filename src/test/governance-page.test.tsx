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
const fetchGovernanceExceptions = vi.fn();
const createGovernanceException = vi.fn();
const revokeGovernanceException = vi.fn();
const fetchServices = vi.fn();
const fetchServiceDeployPolicyCheck = vi.fn();
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
  fetchGovernanceExceptions: (...args: unknown[]) => fetchGovernanceExceptions(...args),
  createGovernanceException: (...args: unknown[]) => createGovernanceException(...args),
  revokeGovernanceException: (...args: unknown[]) => revokeGovernanceException(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock('@/lib/data', () => ({
  fetchServices: (...args: unknown[]) => fetchServices(...args),
  fetchServiceDeployPolicyCheck: (...args: unknown[]) => fetchServiceDeployPolicyCheck(...args),
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
    dryRun: false,
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
    fetchGovernanceExceptions.mockResolvedValue([]);
    createGovernanceException.mockResolvedValue({});
    revokeGovernanceException.mockResolvedValue({});
    fetchServices.mockResolvedValue([]);
    fetchServiceDeployPolicyCheck.mockResolvedValue(null);
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

  it('refreshes audit logs after an atomic governance change', async () => {
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

    const policyToggleRow = screen.getByText('Enable deploy policy').closest('div');
    if (!policyToggleRow) throw new Error('Enable deploy policy row not found');
    fireEvent.click(within(policyToggleRow.parentElement as HTMLElement).getByRole('switch'));

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

  it('runs policy simulation against current services', async () => {
    fetchServices.mockResolvedValue([
      {
        id: 'svc-1',
        name: 'checkout-api',
        projectId: 'proj-1',
        sourceType: 'registry',
        managementMode: 'managed',
      },
    ]);
    fetchServiceDeployPolicyCheck.mockResolvedValue({
      environment: 'prod',
      trigger: 'manual',
      sourceType: 'registry',
      strategyType: 'rolling',
      replicas: 2,
      explicitVersion: true,
      dryRun: false,
      target: {},
      violations: [
        {
          code: 'explicit-version-required',
          environment: 'prod',
          message: 'Version pinning is required in production.',
        },
      ],
    });

    renderPage();

    const policiesTab = await screen.findByRole('tab', { name: /policies/i });
    fireEvent.mouseDown(policiesTab);
    fireEvent.click(policiesTab);

    const runButtons = await screen.findAllByRole('button', { name: /run simulation/i });
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(fetchServices).toHaveBeenCalled();
      expect(fetchServiceDeployPolicyCheck).toHaveBeenCalledWith('svc-1', 'prod');
    });

    expect(await screen.findByText('checkout-api')).toBeInTheDocument();
    expect(screen.getAllByText(/version pinning is required in production/i).length).toBeGreaterThan(0);
  });

  it('creates a temporary exception from the policies tab', async () => {
    fetchServices.mockResolvedValue([
      {
        id: 'svc-1',
        name: 'checkout-api',
        projectId: 'proj-1',
      },
    ]);
    fetchGovernanceExceptions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'gexc-1',
          policy: 'deploy-policy',
          serviceId: 'svc-1',
          serviceName: 'checkout-api',
          environment: 'prod',
          codes: ['*'],
          reason: 'Migration window',
          expiresAt: '2026-03-30T12:00:00Z',
          status: 'active',
          createdAt: '2026-03-29T12:00:00Z',
        },
      ]);

    renderPage();

    const policiesTab = await screen.findByRole('tab', { name: /policies/i });
    fireEvent.mouseDown(policiesTab);
    fireEvent.click(policiesTab);

    fireEvent.click(await screen.findByRole('button', { name: /new exception/i }));
    fireEvent.change(screen.getByPlaceholderText(/explain why this service needs a temporary exception/i), {
      target: { value: 'Migration window' },
    });
    fireEvent.change(screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/), {
      target: { value: '2026-03-30T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create exception/i }));

    await waitFor(() => {
      expect(createGovernanceException).toHaveBeenCalledWith(expect.objectContaining({
        policy: 'deploy-policy',
        serviceId: 'svc-1',
        environment: 'prod',
        reason: 'Migration window',
      }));
      expect(fetchGovernanceExceptions).toHaveBeenCalledTimes(2);
    });
  });
});
