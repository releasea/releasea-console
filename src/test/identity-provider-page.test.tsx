import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityProviderPage from '@/pages/identity-provider/IdentityProviderPage';

const fetchIdpConnections = vi.fn();
const createIdpConnection = vi.fn();
const updateIdpConnection = vi.fn();
const updateIdpConfig = vi.fn();

const config = {
  saml: {
    enabled: false, entityId: '', ssoUrl: '', sloUrl: '', certificate: '', signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256', nameIdFormat: 'emailAddress', assertionEncrypted: false,
    wantAuthnRequestsSigned: true, allowUnsolicitedResponse: false,
    attributeMapping: { email: 'email', firstName: 'first_name', lastName: 'last_name', groups: 'groups' },
  },
  oidc: {
    enabled: false, issuer: '', clientId: '', clientSecret: '', scopes: [], responseType: 'code',
    tokenEndpointAuth: 'client_secret_post', userinfoEndpoint: '', jwksUri: '',
    attributeMapping: { email: 'email', firstName: 'given_name', lastName: 'family_name', groups: 'groups' },
  },
  provisioning: { autoProvision: false, autoDeprovision: false, syncInterval: 60, defaultRole: 'developer', createTeamsFromGroups: false },
  session: { maxAge: 86400, idleTimeout: 3600, singleLogout: false, forceReauth: false },
  security: { requireMfa: false, allowedDomains: [], blockedDomains: [], ipRestrictions: [] },
} as const;

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/data', () => ({ fetchTeams: vi.fn().mockResolvedValue([]) }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/idp-data', () => ({
  fetchIdpConfig: vi.fn(async () => config),
  updateIdpConfig: (...args: unknown[]) => updateIdpConfig(...args),
  fetchIdpConnections: (...args: unknown[]) => fetchIdpConnections(...args),
  createIdpConnection: (...args: unknown[]) => createIdpConnection(...args),
  updateIdpConnection: (...args: unknown[]) => updateIdpConnection(...args),
  deleteIdpConnection: vi.fn().mockResolvedValue(true),
  fetchGroupMappings: vi.fn().mockResolvedValue([]),
  createGroupMapping: vi.fn(),
  deleteGroupMapping: vi.fn(),
  syncGroupMappings: vi.fn(),
  fetchIdpSessions: vi.fn().mockResolvedValue([]),
  revokeIdpSession: vi.fn(),
  fetchIdpAuditLogs: vi.fn().mockResolvedValue([]),
  testIdpConnection: vi.fn(),
}));

describe('IdentityProviderPage connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchIdpConnections.mockResolvedValue([]);
    createIdpConnection.mockResolvedValue({
      id: 'idp-saml', name: 'SAML 2.0', protocol: 'saml', status: 'inactive',
      createdAt: '2026-08-19T10:00:00Z', usersCount: 0, groupsCount: 0,
    });
    updateIdpConnection.mockResolvedValue(true);
    updateIdpConfig.mockImplementation(async (nextConfig) => nextConfig);
  });

  const renderPage = () => render(<MemoryRouter><IdentityProviderPage /></MemoryRouter>);

  it('shows an empty state and provider cards in the add dialog', async () => {
    renderPage();

    expect(await screen.findByText('No identity providers yet')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add identity provider' })[0]);

    expect(screen.getByRole('dialog', { name: 'Add identity provider' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SAML 2.0 Enterprise SSO/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OpenID Connect Modern OAuth/i })).toBeInTheDocument();
  });

  it('creates a provider and only shows its footer save action after enabling it', async () => {
    renderPage();
    await screen.findByText('No identity providers yet');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add identity provider' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /SAML 2.0 Enterprise SSO/i }));

    await waitFor(() => expect(createIdpConnection).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'saml' })));
    expect(screen.queryByRole('button', { name: 'Save SAML provider' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Enable SAML 2.0' }));
    expect(await screen.findByRole('button', { name: 'Save SAML provider' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save SAML provider' }));
    await waitFor(() => {
      expect(updateIdpConnection).toHaveBeenCalledWith('idp-saml', expect.objectContaining({ status: 'active' }));
      expect(updateIdpConfig).toHaveBeenCalled();
    });
  });

  it('persists provisioning and security controls atomically', async () => {
    renderPage();
    await screen.findByText('No identity providers yet');

    const provisioningTab = screen.getByRole('tab', { name: /provisioning/i });
    fireEvent.mouseDown(provisioningTab);
    fireEvent.click(provisioningTab);
    const autoProvisionRow = await screen.findByText('Auto-provision users');
    fireEvent.click(autoProvisionRow.closest('div')?.parentElement?.querySelector('[role="switch"]') as HTMLElement);
    await waitFor(() => expect(updateIdpConfig).toHaveBeenCalledWith(expect.objectContaining({
      provisioning: expect.objectContaining({ autoProvision: true }),
    })));
    expect(screen.queryByRole('button', { name: /save provisioning|save sessions/i })).not.toBeInTheDocument();

    const securityTab = screen.getByRole('tab', { name: /security/i });
    fireEvent.mouseDown(securityTab);
    fireEvent.click(securityTab);
    const mfaRow = await screen.findByText('Require MFA');
    fireEvent.click(mfaRow.closest('div')?.parentElement?.querySelector('[role="switch"]') as HTMLElement);
    await waitFor(() => expect(updateIdpConfig).toHaveBeenCalledWith(expect.objectContaining({
      security: expect.objectContaining({ requireMfa: true }),
    })));
    expect(screen.queryByRole('button', { name: /save security/i })).not.toBeInTheDocument();
  });
});
