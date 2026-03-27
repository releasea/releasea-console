import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformPreferencesProvider } from '@/contexts/PlatformPreferencesContext';
import SettingsPage from '@/pages/settings/SettingsPage';

const fetchPlatformSettings = vi.fn();
const fetchProviderCatalog = vi.fn();
const fetchProviderStatus = vi.fn();
const fetchProviderHealth = vi.fn();
const fetchProjects = vi.fn();
const fetchServices = vi.fn();
const fetchScmCredentials = vi.fn();
const fetchRegistryCredentials = vi.fn();
const fetchServiceTemplates = vi.fn();

vi.mock('@/lib/data', () => ({
  createRegistryCredential: vi.fn(),
  createScmCredential: vi.fn(),
  deleteRegistryCredential: vi.fn(),
  deleteScmCredential: vi.fn(),
  fetchPlatformSettings: (...args: unknown[]) => fetchPlatformSettings(...args),
  fetchProviderCatalog: (...args: unknown[]) => fetchProviderCatalog(...args),
  fetchProviderHealth: (...args: unknown[]) => fetchProviderHealth(...args),
  fetchProviderStatus: (...args: unknown[]) => fetchProviderStatus(...args),
  fetchProjects: (...args: unknown[]) => fetchProjects(...args),
  fetchRegistryCredentials: (...args: unknown[]) => fetchRegistryCredentials(...args),
  fetchScmCredentials: (...args: unknown[]) => fetchScmCredentials(...args),
  fetchServices: (...args: unknown[]) => fetchServices(...args),
  fetchServiceTemplates: (...args: unknown[]) => fetchServiceTemplates(...args),
  createServiceTemplate: vi.fn(),
  updateServiceTemplate: vi.fn(),
  deleteServiceTemplate: vi.fn(),
  updatePlatformSettings: vi.fn(),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const providerCatalogFixture = {
  version: '1',
  scm: {
    kind: 'scm',
    label: 'SCM',
    description: 'Source control',
    defaultProvider: 'github',
    providers: [{ id: 'github', label: 'GitHub', capabilities: ['commit-history'] }],
  },
  registry: { kind: 'registry', label: 'Registry', description: 'Registries', defaultProvider: 'docker', providers: [] },
  secrets: { kind: 'secrets', label: 'Secrets', description: 'Secrets', defaultProvider: 'vault', providers: [] },
  identity: { kind: 'identity', label: 'Identity', description: 'Identity', defaultProvider: 'oidc', providers: [] },
  notifications: { kind: 'notifications', label: 'Notifications', description: 'Notifications', defaultProvider: 'platform-events', providers: [] },
};

const providerStatusFixture = {
  version: '1',
  scm: { kind: 'scm', providers: [{ id: 'github', label: 'GitHub', state: 'configured', configured: true, resourceCount: 1 }] },
  registry: { kind: 'registry', providers: [] },
  secrets: { kind: 'secrets', providers: [] },
  identity: { kind: 'identity', providers: [] },
  notifications: { kind: 'notifications', providers: [] },
};

const providerHealthFixture = {
  version: '1',
  scm: {
    kind: 'scm',
    healthy: 1,
    unhealthy: 0,
    checks: [
      {
        providerId: 'github',
        providerLabel: 'GitHub',
        resourceId: 'scm-1',
        resourceLabel: 'Platform GitHub',
        scope: 'platform',
        state: 'healthy',
        message: 'Credential validated successfully',
      },
    ],
  },
  registry: { kind: 'registry', healthy: 0, unhealthy: 0, checks: [] },
  secrets: { kind: 'secrets', healthy: 0, unhealthy: 0, checks: [] },
  identity: { kind: 'identity', healthy: 0, unhealthy: 0, checks: [] },
  notifications: { kind: 'notifications', healthy: 0, unhealthy: 0, checks: [] },
};

describe('SettingsPage provider health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPlatformSettings.mockResolvedValue({
      organization: { name: 'Releasea', slug: 'releasea', apiUrl: 'https://api.releasea.io' },
      notifications: {},
      integrations: [],
      secrets: { providers: [], defaultProviderId: '' },
    });
    fetchProviderCatalog.mockResolvedValue(providerCatalogFixture);
    fetchProviderStatus.mockResolvedValue(providerStatusFixture);
    fetchProviderHealth.mockResolvedValue(providerHealthFixture);
    fetchProjects.mockResolvedValue([]);
    fetchServices.mockResolvedValue([]);
    fetchScmCredentials.mockResolvedValue([]);
    fetchRegistryCredentials.mockResolvedValue([]);
    fetchServiceTemplates.mockResolvedValue([]);
  });

  it('runs provider health checks and renders live results', async () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=general']}>
        <PlatformPreferencesProvider>
          <SettingsPage />
        </PlatformPreferencesProvider>
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', { name: /run health checks/i });
    fireEvent.click(button);

    await waitFor(() => expect(fetchProviderHealth).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Platform GitHub')).toBeInTheDocument();
    expect(await screen.findByText('Credential validated successfully')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
