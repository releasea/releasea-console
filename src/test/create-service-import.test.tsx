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
    createService.mockResolvedValue({
      id: 'svc-1',
      name: 'payments',
      type: 'microservice',
    });
    performAction.mockResolvedValue(false);
    updateService.mockResolvedValue(null);

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
      {
        id: 'proj-default',
        name: 'Default',
        slug: 'default',
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
        containers: [
          {
            name: 'payments',
            image: 'ghcr.io/acme/payments:1.2.3',
            ports: [8080],
            imported: true,
            healthCheckPath: '/ready',
            probes: [
              { type: 'readiness', handler: 'httpGet', containerName: 'payments', path: '/ready', port: '8080' },
            ],
            environmentVariables: [
              { key: 'PAYMENTS_MODE', value: 'cluster' },
              { key: 'LOG_LEVEL', value: 'debug' },
              { key: 'DB_PASSWORD', sourceType: 'secretKeyRef', reference: 'secret:payments#password', importable: false },
            ],
            command: ['/bin/payments'],
            args: ['serve', '--port', '8080'],
            cpuMilli: 500,
            memoryMi: 512,
          },
          {
            name: 'metrics-sidecar',
            image: 'ghcr.io/acme/metrics:0.4.0',
            ports: [9090],
            probes: [
              { type: 'liveness', handler: 'tcpSocket', containerName: 'metrics-sidecar', port: '9090' },
            ],
            environmentVariables: [
              { key: 'METRICS_PORT', value: '9090' },
            ],
            command: ['/bin/metrics-sidecar'],
            args: ['--listen', '0.0.0.0:9090'],
            cpuMilli: 250,
            memoryMi: 256,
          },
        ],
        serviceHints: [
          { name: 'payments', type: 'ClusterIP', ports: [80, 8080] },
        ],
        ingressHints: [
          { name: 'payments', hosts: ['payments.example.com'], paths: ['/'], tls: true, serviceNames: ['payments'] },
        ],
        images: ['ghcr.io/acme/payments:1.2.3'],
        primaryImage: 'ghcr.io/acme/payments:1.2.3',
        ports: [8080],
        port: 8080,
        replicas: 2,
        healthCheckPath: '/ready',
        probes: [
          { type: 'readiness', handler: 'httpGet', containerName: 'payments', path: '/ready', port: '8080' },
          { type: 'liveness', handler: 'tcpSocket', containerName: 'payments', port: '8080' },
        ],
        environmentVariables: [
          { key: 'PAYMENTS_MODE', value: 'cluster' },
          { key: 'LOG_LEVEL', value: 'debug' },
          { key: 'DB_PASSWORD', sourceType: 'secretKeyRef', reference: 'secret:payments#password', importable: false },
        ],
        command: ['/bin/payments'],
        args: ['serve', '--port', '8080'],
        cpuMilli: 500,
        memoryMi: 512,
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
    fetchRuntimeProfiles.mockResolvedValue([
      {
        id: 'rp-small',
        name: 'small',
        cpu: '250m',
        cpuLimit: '500m',
        memory: '256Mi',
        memoryLimit: '512Mi',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'rp-medium',
        name: 'medium',
        cpu: '500m',
        cpuLimit: '1000m',
        memory: '512Mi',
        memoryLimit: '1024Mi',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('selects the default project and exposes idle scaling settings', async () => {
    render(
      <MemoryRouter initialEntries={['/services/create']}>
        <CreateServicePage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /adoptable microservice/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Default');
    });

    const pauseSwitch = screen.getByRole('switch', { name: 'Pause service when idle' });
    expect(screen.queryByLabelText('Idle timeout (minutes)')).not.toBeInTheDocument();
    fireEvent.click(pauseSwitch);
    expect(screen.getByLabelText('Idle timeout (minutes)')).toHaveValue(60);
  });

  it('pre-fills service fields from a discovered cluster workload', async () => {
    render(
      <MemoryRouter initialEntries={['/services/create?project=proj-1']}>
        <CreateServicePage />
      </MemoryRouter>,
    );

    const templateButton = await screen.findByRole('button', { name: /adoptable microservice/i });
    fireEvent.click(templateButton);

    const importSectionHeading = await screen.findByText('Import from cluster');
    const importSection = importSectionHeading.closest('section');
    expect(importSection).not.toBeNull();

    const trigger = within(importSection as HTMLElement).getByRole('combobox');
    trigger.focus();
    fireEvent.mouseDown(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown', code: 'ArrowDown' });

    const option = await screen.findByRole('option', { name: 'payments · dev · Deployment' });
    fireEvent.click(option);

    await screen.findByText(/cluster-a · ns: releasea-apps-development/i);
    expect(await screen.findByText(/Service and ingress hints/i)).toBeInTheDocument();
    expect(screen.getByText(/payments\.example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/ports 80, 8080/i)).toBeInTheDocument();
    expect(await screen.findByText(/Adoption readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Close, but review the imported runtime details/i)).toBeInTheDocument();
    expect(screen.getByText(/Import preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Container image/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Aligned/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Review/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 cluster-native reference\(s\) still require manual recreation/i)).toBeInTheDocument();
    expect(await screen.findByText(/Detected probes/i)).toBeInTheDocument();
    expect(screen.getByText(/readiness \(payments\): HTTP \/ready on 8080/i)).toBeInTheDocument();
    const additionalContainersWarning = screen.getByText(/Other containers are still outside the service form/i).closest('div');
    expect(additionalContainersWarning).not.toBeNull();
    expect(within(additionalContainersWarning as HTMLElement).getByText(/metrics-sidecar/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Service Name')).toHaveValue('payments');
      expect(screen.getByLabelText('Docker Image')).toHaveValue('ghcr.io/acme/payments:1.2.3');
      expect(screen.getByLabelText('Port')).toHaveValue(8080);
      expect(screen.getByLabelText('Health Check Path')).toHaveValue('/ready');
    });

    expect(screen.getByDisplayValue('PAYMENTS_MODE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('cluster')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LOG_LEVEL')).toBeInTheDocument();
    expect(screen.getByDisplayValue('debug')).toBeInTheDocument();
    expect(screen.getByText(/cluster-native environment references were not imported automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/DB_PASSWORD/i)).toBeInTheDocument();
    expect(screen.getAllByText('medium (500m, 512Mi)').length).toBeGreaterThan(0);

    const containerTrigger = within(importSection as HTMLElement).getAllByRole('combobox')[1];
    fireEvent.click(containerTrigger);
    fireEvent.click(await screen.findByRole('option', { name: /metrics-sidecar/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Docker Image')).toHaveValue('ghcr.io/acme/metrics:0.4.0');
      expect(screen.getByLabelText('Port')).toHaveValue(9090);
    });
    const metricsKeyInput = screen.getByDisplayValue('METRICS_PORT');
    const metricsRow = metricsKeyInput.closest('div.grid');
    expect(metricsRow).not.toBeNull();
    expect(within(metricsRow as HTMLElement).getByDisplayValue('9090')).toBeInTheDocument();
    const updatedAdditionalContainersWarning = screen
      .getByText(/Other containers are still outside the service form/i)
      .closest('div');
    expect(updatedAdditionalContainersWarning).not.toBeNull();
    expect(within(updatedAdditionalContainersWarning as HTMLElement).getByText('payments')).toBeInTheDocument();
    expect(
      within(updatedAdditionalContainersWarning as HTMLElement).getByText(/ghcr\.io\/acme\/payments:1\.2\.3/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create service/i }));

    await waitFor(() => {
      expect(createService).toHaveBeenCalled();
    });

    const payload = createService.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        dockerCommand: '/bin/metrics-sidecar --listen 0.0.0.0:9090',
        dockerImage: 'ghcr.io/acme/metrics:0.4.0',
        port: 9090,
        profileId: 'rp-small',
        environment: {
          METRICS_PORT: '9090',
        },
      }),
    );
    expect(payload?.environment?.PAYMENTS_MODE).toBeUndefined();
    expect(payload?.environment?.DB_PASSWORD).toBeUndefined();
  });

  it('groups the catalog by workload blueprint and supports starter-path filters', async () => {
    fetchServiceTemplates.mockResolvedValue([
      {
        id: 'tpl-api',
        type: 'microservice',
        label: 'API Blueprint',
        description: 'HTTP service starter',
        icon: 'server',
        category: 'Services',
        owner: 'releasea',
        bestFor: 'APIs',
        defaults: 'Git repo + health checks',
        setupTime: '5 min',
        tier: 'core',
        highlights: ['recommended'],
        templateKind: 'service',
        repoMode: 'template',
        allowTemplateToggle: true,
      },
      {
        id: 'tpl-job',
        type: 'microservice',
        label: 'Nightly Cleanup Job',
        description: 'Recurring cleanup',
        icon: 'clock',
        category: 'Jobs',
        owner: 'releasea',
        bestFor: 'Maintenance',
        defaults: 'Cron runtime',
        setupTime: '4 min',
        tier: 'core',
        highlights: ['cron'],
        templateKind: 'scheduled-job',
        repoMode: 'template',
        allowTemplateToggle: true,
      },
      {
        id: 'tpl-vite',
        type: 'static-site',
        label: 'Vite Marketing Site',
        description: 'Frontend starter',
        icon: 'globe',
        category: 'Sites',
        owner: 'releasea',
        bestFor: 'Web apps',
        defaults: 'Vite build',
        setupTime: '3 min',
        tier: 'core',
        highlights: ['vite'],
        templateKind: 'service',
        repoMode: 'template',
        allowTemplateToggle: true,
        templateDefaults: {
          framework: 'vite',
        },
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/services/create?project=proj-1']}>
        <CreateServicePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Services and APIs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scheduled Jobs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Static Sites' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Static Sites · 1' }));
    expect(await screen.findByRole('heading', { name: 'Static Sites' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Services and APIs' })).not.toBeInTheDocument();
    expect(screen.queryByText('API Blueprint')).not.toBeInTheDocument();
    expect(screen.getByText('Vite Marketing Site')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vite · 1' }));
    expect(screen.getByText('Vite Marketing Site')).toBeInTheDocument();
    expect(screen.queryByText('Nightly Cleanup Job')).not.toBeInTheDocument();
  });
});
