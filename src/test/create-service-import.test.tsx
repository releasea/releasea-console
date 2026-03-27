import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateServicePage from '@/pages/services/CreateServicePage';

const checkGithubTemplateRepoAvailability = vi.fn();
const createGithubTemplateRepo = vi.fn();
const createService = vi.fn();
const fetchDiscoveredWorkloads = vi.fn();
const fetchEnvironments = vi.fn();
const performAction = vi.fn();
const updateService = vi.fn();
const fetchWorkers = vi.fn();
const fetchWorkerRegistrations = vi.fn();
const fetchPlatformSettings = vi.fn();
const fetchProjects = vi.fn();
const fetchRegistryCredentials = vi.fn();
const fetchScmCredentials = vi.fn();
const fetchServiceTemplates = vi.fn();
const fetchRuntimeProfiles = vi.fn();
const toast = vi.fn();

vi.mock('@/lib/data', () => ({
  checkGithubTemplateRepoAvailability: (...args: unknown[]) => checkGithubTemplateRepoAvailability(...args),
  createGithubTemplateRepo: (...args: unknown[]) => createGithubTemplateRepo(...args),
  createService: (...args: unknown[]) => createService(...args),
  fetchDiscoveredWorkloads: (...args: unknown[]) => fetchDiscoveredWorkloads(...args),
  fetchEnvironments: (...args: unknown[]) => fetchEnvironments(...args),
  performAction: (...args: unknown[]) => performAction(...args),
  updateService: (...args: unknown[]) => updateService(...args),
  fetchWorkers: (...args: unknown[]) => fetchWorkers(...args),
  fetchWorkerRegistrations: (...args: unknown[]) => fetchWorkerRegistrations(...args),
  fetchPlatformSettings: (...args: unknown[]) => fetchPlatformSettings(...args),
  fetchProjects: (...args: unknown[]) => fetchProjects(...args),
  fetchRegistryCredentials: (...args: unknown[]) => fetchRegistryCredentials(...args),
  fetchScmCredentials: (...args: unknown[]) => fetchScmCredentials(...args),
  fetchServiceTemplates: (...args: unknown[]) => fetchServiceTemplates(...args),
  fetchRuntimeProfiles: (...args: unknown[]) => fetchRuntimeProfiles(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageBackLink', () => ({
  PageBackLink: () => <div>Back</div>,
}));

describe('CreateServicePage cluster import', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fetchProjects.mockResolvedValue([
      {
        id: 'proj-1',
        name: 'Payments',
        slug: 'payments',
        description: '',
        teamId: 'team-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        services: [],
      },
    ]);
    fetchEnvironments.mockResolvedValue([
      { id: 'dev', name: 'Development', description: 'Development' },
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
    fetchWorkerRegistrations.mockResolvedValue([]);
    fetchDiscoveredWorkloads.mockResolvedValue([
      {
        id: 'cluster-a|releasea-apps-development|Deployment|payments',
        workerId: 'wkr-1',
        workerName: 'Development Worker',
        environment: 'dev',
        cluster: 'cluster-a',
        namespace: 'releasea-apps-development',
        kind: 'Deployment',
        name: 'payments',
        images: ['ghcr.io/acme/payments:1.2.3'],
        primaryImage: 'ghcr.io/acme/payments:1.2.3',
        ports: [8080],
        port: 8080,
        replicas: 2,
        healthCheckPath: '/ready',
        templateKind: 'service',
        sourceType: 'registry',
        serviceType: 'microservice',
      },
    ]);
    fetchScmCredentials.mockResolvedValue([]);
    fetchRegistryCredentials.mockResolvedValue([]);
    fetchPlatformSettings.mockResolvedValue({
      organization: { name: 'Releasea', slug: 'releasea', apiUrl: 'https://api.releasea.io' },
      notifications: {},
      integrations: [],
      secrets: { providers: [], defaultProviderId: '' },
    });
    fetchServiceTemplates.mockResolvedValue([
      {
        id: 'tpl-import-service',
        type: 'microservice',
        label: 'Adoptable Microservice',
        description: 'Existing repo or image',
        icon: 'server',
        category: 'Services',
        owner: 'releasea',
        bestFor: 'Adoption',
        defaults: 'Existing image',
        setupTime: '2 min',
        tier: 'core',
        highlights: [],
        templateKind: 'service',
        repoMode: 'existing',
        allowTemplateToggle: true,
      },
    ]);
    fetchRuntimeProfiles.mockResolvedValue([]);
  });

  it('pre-fills service fields from a discovered cluster workload', async () => {
    render(
      <MemoryRouter initialEntries={['/services/create?project=proj-1']}>
        <CreateServicePage />
      </MemoryRouter>,
    );

    const templateButton = await screen.findByRole('button', { name: /adoptable microservice/i });
    fireEvent.click(templateButton);

    const importSectionHeading = await screen.findByText('Import From Cluster');
    const importSection = importSectionHeading.closest('section');
    expect(importSection).not.toBeNull();

    const trigger = within(importSection as HTMLElement).getByRole('combobox');
    trigger.focus();
    fireEvent.mouseDown(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown', code: 'ArrowDown' });

    const option = await screen.findByRole('option', { name: 'payments · dev · Deployment' });
    fireEvent.click(option);

    await screen.findByText(/cluster-a · ns: releasea-apps-development/i);

    await waitFor(() => {
      expect(screen.getByLabelText('Service Name')).toHaveValue('payments');
      expect(screen.getByLabelText('Docker Image')).toHaveValue('ghcr.io/acme/payments:1.2.3');
      expect(screen.getByLabelText('Port')).toHaveValue(8080);
      expect(screen.getByLabelText('Health Check Path')).toHaveValue('/ready');
    });
  });
});
