import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/pages/dashboard/IndexPage';

const fetchDeploys = vi.fn();
const fetchProviderHealth = vi.fn();
const fetchProviderStatus = vi.fn();
const fetchProjects = vi.fn();
const fetchRegistryCredentials = vi.fn();
const fetchScmCredentials = vi.fn();
const fetchServices = vi.fn();
const fetchWorkerPools = vi.fn();
const fetchWorkerRegistrations = vi.fn();
const fetchWorkers = vi.fn();
const hasPermission = vi.fn();

vi.mock('@/lib/data', () => ({
  fetchDeploys: (...args: unknown[]) => fetchDeploys(...args),
  fetchProviderHealth: (...args: unknown[]) => fetchProviderHealth(...args),
  fetchProviderStatus: (...args: unknown[]) => fetchProviderStatus(...args),
  fetchProjects: (...args: unknown[]) => fetchProjects(...args),
  fetchRegistryCredentials: (...args: unknown[]) => fetchRegistryCredentials(...args),
  fetchScmCredentials: (...args: unknown[]) => fetchScmCredentials(...args),
  fetchServices: (...args: unknown[]) => fetchServices(...args),
  fetchWorkerPools: (...args: unknown[]) => fetchWorkerPools(...args),
  fetchWorkerRegistrations: (...args: unknown[]) => fetchWorkerRegistrations(...args),
  fetchWorkers: (...args: unknown[]) => fetchWorkers(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: (...args: unknown[]) => hasPermission(...args),
  }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/dashboard/ServicesList', () => ({
  ServicesList: () => <div>services list</div>,
}));

describe('Dashboard onboarding checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPermission.mockImplementation((role: string) => role === 'developer' || role === 'admin');
    fetchProjects.mockResolvedValue([]);
    fetchServices.mockResolvedValue([]);
    fetchWorkerPools.mockResolvedValue([]);
    fetchDeploys.mockResolvedValue([]);
    fetchWorkers.mockResolvedValue([]);
    fetchWorkerRegistrations.mockResolvedValue([]);
    fetchScmCredentials.mockResolvedValue([]);
    fetchRegistryCredentials.mockResolvedValue([]);
    fetchProviderStatus.mockResolvedValue({
      version: '1',
      scm: {
        kind: 'scm',
        providers: [{ id: 'github', label: 'GitHub', state: 'not-configured', configured: false }],
      },
      registry: {
        kind: 'registry',
        providers: [{ id: 'ghcr', label: 'GHCR', state: 'not-configured', configured: false }],
      },
      secrets: {
        kind: 'secrets',
        providers: [{ id: 'vault', label: 'Vault', state: 'not-configured', configured: false }],
      },
      identity: { kind: 'identity', providers: [] },
      notifications: { kind: 'notifications', providers: [] },
    });
    fetchProviderHealth.mockResolvedValue({
      version: '1',
      scm: { kind: 'scm', healthy: 1, unhealthy: 0, checks: [{ providerId: 'github', providerLabel: 'GitHub', state: 'healthy' }] },
      registry: { kind: 'registry', healthy: 1, unhealthy: 0, checks: [{ providerId: 'ghcr', providerLabel: 'GHCR', state: 'healthy' }] },
      secrets: { kind: 'secrets', healthy: 0, unhealthy: 1, checks: [{ providerId: 'vault', providerLabel: 'Vault', state: 'unhealthy' }] },
      identity: { kind: 'identity', healthy: 0, unhealthy: 0, checks: [] },
      notifications: { kind: 'notifications', healthy: 0, unhealthy: 0, checks: [] },
    });
  });

  it('shows the first-run checklist and actionable empty state for a fresh install', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Getting started with Releasea')).toBeInTheDocument();
    expect(screen.getByText('Integration readiness')).toBeInTheDocument();
    expect(screen.getByText('First deploy guide')).toBeInTheDocument();
    expect(screen.getByText('Connect a Git provider')).toBeInTheDocument();
    expect(screen.getByText('Connect a container registry')).toBeInTheDocument();
    expect(screen.getByText('Have a worker ready')).toBeInTheDocument();
    expect(screen.getByText('Create the first project')).toBeInTheDocument();
    expect(screen.getByText('0/6 complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run live checks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Finish platform setup' })).toHaveAttribute('href', '/settings?tab=credentials');
    expect(screen.getAllByRole('link', { name: 'Create project' }).length).toBeGreaterThan(0);
    expect(screen.getByText('No services yet')).toBeInTheDocument();
    expect(screen.getByText(/create the first project, then add a service/i)).toBeInTheDocument();
    expect(screen.getByText('No deploy history yet')).toBeInTheDocument();
  });

  it('guides the user to the first deploy once prerequisites and a service exist', async () => {
    fetchProjects.mockResolvedValue([
      {
        id: 'proj-1',
        name: 'Payments',
        slug: 'payments',
        description: '',
        teamId: 'team-1',
        createdAt: '2026-03-28T00:00:00Z',
        updatedAt: '2026-03-28T00:00:00Z',
        services: [],
      },
    ]);
    fetchServices.mockResolvedValue([
      {
        id: 'svc-1',
        name: 'payments',
        type: 'microservice',
        status: 'created',
        projectId: 'proj-1',
        replicas: 1,
        cpu: 250,
        memory: 256,
        createdAt: '2026-03-28T00:00:00Z',
        environment: {},
        ruleIds: [],
        sourceType: 'git',
      },
    ]);
    fetchWorkers.mockResolvedValue([
      {
        id: 'wkr-1',
        name: 'Development Worker',
        environment: 'dev',
        namespace: 'releasea-apps-development',
        cluster: 'cluster-a',
        version: '1.0.0',
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        tasksCompleted: 0,
        desiredAgents: 1,
        onlineAgents: 1,
        registeredAt: new Date().toISOString(),
      },
    ]);
    fetchScmCredentials.mockResolvedValue([{ id: 'scm-1', name: 'GitHub', provider: 'github', scope: 'platform', tokenHint: 'ghp_***' }]);
    fetchRegistryCredentials.mockResolvedValue([{ id: 'reg-1', name: 'GHCR', provider: 'ghcr', scope: 'platform', registryUrl: 'ghcr.io' }]);
    fetchProviderStatus.mockResolvedValue({
      version: '1',
      scm: { kind: 'scm', providers: [{ id: 'github', label: 'GitHub', state: 'configured', configured: true }] },
      registry: { kind: 'registry', providers: [{ id: 'ghcr', label: 'GHCR', state: 'configured', configured: true }] },
      secrets: { kind: 'secrets', providers: [] },
      identity: { kind: 'identity', providers: [] },
      notifications: { kind: 'notifications', providers: [] },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('First deploy guide')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open guided deploy' })).toHaveAttribute('href', '/services/svc-1?action=deploy');
    expect(screen.getByText('Step 4')).toBeInTheDocument();
    expect(screen.getByText('First deploy completed')).toBeInTheDocument();
  });

  it('shows an operator health report for admins once deploy history exists', async () => {
    fetchProjects.mockResolvedValue([
      {
        id: 'proj-1',
        name: 'Payments',
        slug: 'payments',
        description: '',
        teamId: 'team-1',
        createdAt: '2026-03-28T00:00:00Z',
        updatedAt: '2026-03-28T00:00:00Z',
        services: [],
      },
    ]);
    fetchServices.mockResolvedValue([
      {
        id: 'svc-1',
        name: 'payments',
        type: 'microservice',
        status: 'running',
        projectId: 'proj-1',
        replicas: 1,
        cpu: 250,
        memory: 256,
        createdAt: '2026-03-28T00:00:00Z',
        environment: {},
        ruleIds: [],
        sourceType: 'git',
      },
    ]);
    fetchDeploys.mockResolvedValue([
      {
        id: 'dep-1',
        serviceId: 'svc-1',
        status: 'completed',
        startedAt: '2026-03-29T10:00:00Z',
        logs: [],
        triggeredBy: 'developer',
      },
    ]);
    fetchWorkers.mockResolvedValue([
      {
        id: 'wkr-1',
        name: 'Production Worker',
        environment: 'prod',
        namespace: 'releasea-apps-prod',
        cluster: 'cluster-a',
        version: '1.0.0',
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        tasksCompleted: 0,
        desiredAgents: 1,
        onlineAgents: 1,
        registeredAt: new Date().toISOString(),
      },
    ]);
    fetchWorkerPools.mockResolvedValue([
      {
        id: 'prod:cluster-a:releasea-apps',
        status: 'online',
        capacityState: 'ready',
        environment: 'prod',
        cluster: 'cluster-a',
        namespacePrefix: 'releasea-apps',
        tags: ['prod'],
        namespaces: ['releasea-apps-prod'],
        workerCount: 1,
        onlineWorkers: 1,
        busyWorkers: 0,
        offlineWorkers: 0,
        pendingWorkers: 0,
        registrationCount: 1,
        activeRegistrations: 1,
        pendingRegistrations: 0,
        inactiveRegistrations: 0,
        desiredAgents: 1,
        onlineAgents: 1,
        availableAgents: 1,
        capacityScore: 100,
        lastHeartbeat: '2026-03-29T10:05:00Z',
      },
    ]);
    fetchProviderHealth.mockResolvedValue({
      version: '1',
      scm: { kind: 'scm', healthy: 1, unhealthy: 0, checks: [{ providerId: 'github', providerLabel: 'GitHub', state: 'healthy' }] },
      registry: { kind: 'registry', healthy: 1, unhealthy: 0, checks: [{ providerId: 'ghcr', providerLabel: 'GHCR', state: 'healthy' }] },
      secrets: { kind: 'secrets', healthy: 1, unhealthy: 0, checks: [{ providerId: 'vault', providerLabel: 'Vault', state: 'healthy' }] },
      identity: { kind: 'identity', healthy: 0, unhealthy: 0, checks: [] },
      notifications: { kind: 'notifications', healthy: 0, unhealthy: 0, checks: [] },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Operator health report')).toBeInTheDocument();
    expect(screen.getByText('Worker pools')).toBeInTheDocument();
    expect(screen.getByText('Recent delivery')).toBeInTheDocument();
    expect(screen.getByText(/ready for routing/i)).toBeInTheDocument();
  });
});
