import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Key,
  Plus,
  Shield,
  Settings2,
  Users,
  Activity,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Link2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { DocumentationLink } from '@/components/layout/DocumentationLink';
import { SettingsGrid, SettingsSection } from '@/components/layout/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { fetchTeams } from '@/lib/data';
import { getApiUrl } from '@/lib/config';
import { maskEmail, maskIPAddress, redactSensitiveText, sanitizeTextForRender } from '@/platform/security/data-security';
import {
  fetchIdpConfig,
  updateIdpConfig,
  fetchGroupMappings,
  createGroupMapping,
  deleteGroupMapping,
  syncGroupMappings,
  fetchIdpSessions,
  revokeIdpSession,
  fetchIdpAuditLogs,
  testIdpConnection,
  fetchIdpConnections,
  createIdpConnection,
  updateIdpConnection,
  deleteIdpConnection,
} from '@/lib/idp-data';
import type { Team } from '@/types/releasea';
import type {
  IdentityProviderConfig,
  GroupMapping,
  IdpSession,
  IdpAuditLog,
  IdpRole,
  IdpConnection,
  IdpProtocol,
} from '@/types/identity-provider';

const roleColors: Record<string, string> = {
  admin: 'bg-warning/10 text-warning border-warning/20',
  developer: 'bg-info/10 text-info border-info/20',
  viewer: 'bg-muted text-muted-foreground border-border',
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'developer':
      return 'Developer';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const IdentityProvider = () => {
  const oidcRedirectUri = getApiUrl('/auth/sso/callback');
  const [activeTab, setActiveTab] = useState('connection');
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<IdentityProviderConfig | null>(null);
  const [groupMappings, setGroupMappings] = useState<GroupMapping[]>([]);
  const [sessions, setSessions] = useState<IdpSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<IdpAuditLog[]>([]);
  const [connections, setConnections] = useState<IdpConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [deletingConnection, setDeletingConnection] = useState<IdpConnection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [atomicSaveStatus, setAtomicSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // SAML State
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [samlEntityId, setSamlEntityId] = useState('');
  const [samlSsoUrl, setSamlSsoUrl] = useState('');
  const [samlSloUrl, setSamlSloUrl] = useState('');
  const [samlCertificate, setSamlCertificate] = useState('');
  const [samlSignatureAlgorithm, setSamlSignatureAlgorithm] = useState<'sha1' | 'sha256' | 'sha512'>('sha256');
  const [samlNameIdFormat, setSamlNameIdFormat] = useState<'emailAddress' | 'persistent' | 'transient' | 'unspecified'>('emailAddress');
  const [samlWantSigned, setSamlWantSigned] = useState(true);

  // OIDC State
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcIssuer, setOidcIssuer] = useState('');
  const [oidcClientId, setOidcClientId] = useState('');
  const [oidcClientSecret, setOidcClientSecret] = useState('');
  const [oidcScopes, setOidcScopes] = useState('openid profile email groups');
  const [oidcTokenAuth, setOidcTokenAuth] = useState<'client_secret_basic' | 'client_secret_post' | 'private_key_jwt'>('client_secret_post');

  // Provisioning State
  const [autoProvision, setAutoProvision] = useState(true);
  const [autoDeprovision, setAutoDeprovision] = useState(false);
  const [syncInterval, setSyncInterval] = useState(60);
  const [defaultRole, setDefaultRole] = useState<IdpRole>('developer');

  // Session State
  const [sessionMaxAge, setSessionMaxAge] = useState(86400);
  const [sessionIdleTimeout, setSessionIdleTimeout] = useState(3600);
  const [singleLogout, setSingleLogout] = useState(true);

  // Security State
  const [requireMfa, setRequireMfa] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState('');

  // Mapping Modal State
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingGroup, setMappingGroup] = useState('');
  const [mappingTeamId, setMappingTeamId] = useState('');
  const [mappingRole, setMappingRole] = useState<IdpRole>('developer');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [teamsData, configData, connectionsData, mappingsData, sessionsData, logsData] = await Promise.all([
        fetchTeams(),
        fetchIdpConfig(),
        fetchIdpConnections(),
        fetchGroupMappings(),
        fetchIdpSessions(),
        fetchIdpAuditLogs(),
      ]);
      if (!active) return;

      setTeams(teamsData);
      setConfig(configData);
      setConnections(connectionsData);
      setEditingConnectionId((current) => current ?? connectionsData[0]?.id ?? null);
      setConnectionsLoading(false);
      setGroupMappings(mappingsData);
      setSessions(sessionsData);
      setAuditLogs(logsData);

      // Populate SAML fields
      setSamlEnabled(configData.saml.enabled);
      setSamlEntityId(configData.saml.entityId);
      setSamlSsoUrl(configData.saml.ssoUrl);
      setSamlSloUrl(configData.saml.sloUrl);
      setSamlCertificate(configData.saml.certificate);
      setSamlSignatureAlgorithm(configData.saml.signatureAlgorithm);
      setSamlNameIdFormat(configData.saml.nameIdFormat);
      setSamlWantSigned(configData.saml.wantAuthnRequestsSigned);

      // Populate OIDC fields
      setOidcEnabled(configData.oidc.enabled);
      setOidcIssuer(configData.oidc.issuer);
      setOidcClientId(configData.oidc.clientId);
      setOidcClientSecret(configData.oidc.clientSecret);
      setOidcScopes(configData.oidc.scopes.join(' '));
      setOidcTokenAuth(configData.oidc.tokenEndpointAuth);

      // Populate Provisioning fields
      setAutoProvision(configData.provisioning.autoProvision);
      setAutoDeprovision(configData.provisioning.autoDeprovision);
      setSyncInterval(configData.provisioning.syncInterval);
      setDefaultRole(configData.provisioning.defaultRole);

      // Populate Session fields
      setSessionMaxAge(configData.session.maxAge);
      setSessionIdleTimeout(configData.session.idleTimeout);
      setSingleLogout(configData.session.singleLogout);

      // Populate Security fields
      setRequireMfa(configData.security.requireMfa);
      setAllowedDomains(configData.security.allowedDomains.join(', '));
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const buildConfig = (): IdentityProviderConfig | null => {
    if (!config) return null;
    return {
      saml: {
        ...config.saml,
        enabled: samlEnabled,
        entityId: samlEntityId,
        ssoUrl: samlSsoUrl,
        sloUrl: samlSloUrl,
        certificate: samlCertificate,
        signatureAlgorithm: samlSignatureAlgorithm,
        nameIdFormat: samlNameIdFormat,
        wantAuthnRequestsSigned: samlWantSigned,
      },
      oidc: {
        ...config.oidc,
        enabled: oidcEnabled,
        issuer: oidcIssuer,
        clientId: oidcClientId,
        clientSecret: oidcClientSecret,
        scopes: oidcScopes.split(/[\s,]+/).filter(Boolean),
        tokenEndpointAuth: oidcTokenAuth,
      },
      provisioning: {
        ...config.provisioning,
        autoProvision,
        autoDeprovision,
        syncInterval,
        defaultRole,
      },
      session: {
        ...config.session,
        maxAge: sessionMaxAge,
        idleTimeout: sessionIdleTimeout,
        singleLogout,
      },
      security: {
        ...config.security,
        requireMfa,
        allowedDomains: allowedDomains.split(/[\s,]+/).filter(Boolean),
      },
    };
  };

  const handleSave = async () => {
    const nextConfig = buildConfig();
    if (!nextConfig) return;
    setIsSaving(true);

    await updateIdpConfig(nextConfig);
    setConfig(nextConfig);
    setIsSaving(false);
    toast({ title: 'Settings saved', description: 'Identity provider configuration updated.' });
  };

  const persistAtomicConfig = async (
    section: 'provisioning' | 'session' | 'security',
    patch: Partial<IdentityProviderConfig[typeof section]>,
  ) => {
    const nextConfig = buildConfig();
    if (!nextConfig) return;
    nextConfig[section] = { ...nextConfig[section], ...patch } as never;
    setConfig(nextConfig);
    setIsSaving(true);
    setAtomicSaveStatus('saving');
    try {
      await updateIdpConfig(nextConfig);
      setAtomicSaveStatus('saved');
      window.setTimeout(() => setAtomicSaveStatus((current) => current === 'saved' ? 'idle' : current), 2500);
    } catch {
      setAtomicSaveStatus('error');
      toast({ title: 'Unable to save identity settings', description: 'Your latest change was not persisted.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddConnection = async (protocol: IdpProtocol) => {
    const existing = connections.find((connection) => connection.protocol === protocol);
    if (existing) {
      setEditingConnectionId(existing.id);
      setAddProviderOpen(false);
      return;
    }

    const connection = await createIdpConnection({
      name: protocol === 'saml' ? 'SAML 2.0' : 'OpenID Connect',
      protocol,
      status: 'inactive',
      usersCount: 0,
      groupsCount: 0,
    });
    if (!connection) {
      toast({ title: 'Unable to add provider', description: 'The connection could not be saved.', variant: 'destructive' });
      return;
    }
    setConnections((current) => [...current, connection]);
    setEditingConnectionId(connection.id);
    setAddProviderOpen(false);
    toast({ title: 'Identity provider added', description: 'Complete the connection details and enable it when ready.' });
  };

  const handleConnectionToggle = async (connection: IdpConnection, enabled: boolean) => {
    if (connection.protocol === 'saml') setSamlEnabled(enabled);
    else setOidcEnabled(enabled);

    if (enabled) {
      setEditingConnectionId(connection.id);
      return;
    }

    if (!config) return;
    const nextConfig: IdentityProviderConfig = {
      ...config,
      [connection.protocol]: { ...config[connection.protocol], enabled: false },
    };
    setIsSaving(true);
    await Promise.all([
      updateIdpConfig(nextConfig),
      updateIdpConnection(connection.id, { status: 'inactive' }),
    ]);
    setConfig(nextConfig);
    setConnections((current) => current.map((item) => (
      item.id === connection.id ? { ...item, status: 'inactive' } : item
    )));
    setIsSaving(false);
    toast({ title: 'Identity provider disabled' });
  };

  const handleSaveConnection = async (connection: IdpConnection) => {
    const nextConfig = buildConfig();
    if (!nextConfig) return;
    setIsSaving(true);
    const summary = connection.protocol === 'saml'
      ? { entityId: samlEntityId, ssoUrl: samlSsoUrl }
      : { issuer: oidcIssuer, clientId: oidcClientId };
    const saved = await updateIdpConnection(connection.id, { status: 'active', ...summary });
    await updateIdpConfig(nextConfig);
    setConfig(nextConfig);
    if (saved) {
      setConnections((current) => current.map((item) => (
        item.id === connection.id ? { ...item, status: 'active', ...summary } : item
      )));
      toast({ title: 'Identity provider saved', description: `${connection.name} is enabled and ready to use.` });
    } else {
      toast({ title: 'Unable to save provider', description: 'Review the connection and try again.', variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleDeleteConnection = async () => {
    if (!deletingConnection) return;
    const connection = deletingConnection;
    const removed = await deleteIdpConnection(connection.id);
    if (!removed) {
      toast({ title: 'Unable to remove provider', variant: 'destructive' });
      return;
    }
    if (config) {
      const nextConfig: IdentityProviderConfig = {
        ...config,
        [connection.protocol]: { ...config[connection.protocol], enabled: false },
      };
      await updateIdpConfig(nextConfig);
      setConfig(nextConfig);
    }
    if (connection.protocol === 'saml') setSamlEnabled(false);
    else setOidcEnabled(false);
    setConnections((current) => current.filter((item) => item.id !== connection.id));
    setDeletingConnection(null);
    setEditingConnectionId(null);
    toast({ title: 'Identity provider removed' });
  };

  const handleTestConnection = async (protocol: 'saml' | 'oidc') => {
    setIsTesting(true);
    const result = await testIdpConnection(protocol);
    setIsTesting(false);
    toast({
      title: result.success ? 'Connection successful' : 'Connection failed',
      description: result.message,
    });
  };

  const handleSyncMappings = async () => {
    setIsSyncing(true);
    await syncGroupMappings();
    setIsSyncing(false);
    toast({ title: 'Sync complete', description: 'Group mappings have been synchronized.' });
  };

  const handleAddMapping = async () => {
    if (!mappingGroup.trim() || !mappingTeamId) {
      toast({ title: 'Validation error', description: 'Please fill all fields.' });
      return;
    }
    const team = teams.find((t) => t.id === mappingTeamId);
    const newMapping = await createGroupMapping({
      externalGroup: mappingGroup.trim(),
      internalTeamId: mappingTeamId,
      internalTeamName: team?.name ?? mappingTeamId,
      role: mappingRole,
      syncEnabled: true,
    });
    setGroupMappings((prev) => [...prev, newMapping]);
    setMappingModalOpen(false);
    setMappingGroup('');
    setMappingTeamId('');
    setMappingRole('developer');
    toast({ title: 'Mapping added', description: `Mapped "${mappingGroup}" to ${team?.name}.` });
  };

  const handleDeleteMapping = async (mappingId: string) => {
    await deleteGroupMapping(mappingId);
    setGroupMappings((prev) => prev.filter((m) => m.id !== mappingId));
    toast({ title: 'Mapping deleted' });
  };

  const handleRevokeSession = async (sessionId: string) => {
    await revokeIdpSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast({ title: 'Session revoked' });
  };

  const getAuditIcon = (action: string) => {
    switch (action) {
      case 'login_success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'login_failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'logout':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'group_sync':
        return <RefreshCw className="w-4 h-4 text-info" />;
      case 'config_update':
        return <Settings2 className="w-4 h-4 text-warning" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const samlConnection = connections.find((connection) => connection.protocol === 'saml');
  const oidcConnection = connections.find((connection) => connection.protocol === 'oidc');

  return (
    <AppLayout>
      <div className="space-y-6">
        <ListPageHeader
          title="Identity Provider"
          description="Connect SSO and automate user access."
          docsSlug="settings-identity-governance"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
            <TabsTrigger value="connection" className="gap-2">
              <Link2 className="w-4 h-4" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="provisioning" className="gap-2">
              <Users className="w-4 h-4" />
              Provisioning
            </TabsTrigger>
            <TabsTrigger value="mappings" className="gap-2">
              <FileText className="w-4 h-4" />
              Mappings
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Activity className="w-4 h-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-6">
            <SettingsSection
              title="Identity providers"
              description="Add and manage the sign-in connections available to your organization"
              actions={(
                <>
                  <DocumentationLink slug="settings-identity-governance" label="SSO guide" variant="button" />
                  {(connectionsLoading || connections.length > 0) && (
                    <Button size="sm" onClick={() => setAddProviderOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add identity provider
                    </Button>
                  )}
                </>
              )}
            >
              {connectionsLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading identity providers...</div>
              ) : connections.length === 0 ? (
                <EmptyState
                  icon={<Shield className="text-muted-foreground/50" />}
                  title="No identity providers yet"
                  description="Add a SAML or OpenID Connect provider to enable single sign-on."
                  actionLabel="Add identity provider"
                  onAction={() => setAddProviderOpen(true)}
                  tone="muted"
                  className="py-10"
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {connections.map((connection) => (
                    <button
                      key={connection.id}
                      type="button"
                      onClick={() => setEditingConnectionId(connection.id)}
                      className={`rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${editingConnectionId === connection.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-muted p-2">
                          {connection.protocol === 'saml' ? <Shield className="w-5 h-5" /> : <Key className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">{connection.name}</p>
                            <Badge variant={connection.status === 'active' ? 'default' : 'secondary'}>
                              {connection.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {connection.protocol === 'saml' ? 'SAML 2.0 enterprise SSO' : 'OAuth 2.0 / OpenID Connect'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SettingsSection>

            {/* SAML Section */}
            {samlConnection && editingConnectionId === samlConnection.id && (
            <SettingsSection
              title={samlConnection.name}
              description="Connect via Security Assertion Markup Language"
              actions={
                <div className="flex items-center gap-2">
                  {samlEnabled && <Badge variant="secondary" className="text-xs">ENABLED</Badge>}
                  <Switch checked={samlEnabled} onCheckedChange={(enabled) => handleConnectionToggle(samlConnection, enabled)} aria-label="Enable SAML 2.0" />
                  <Button variant="ghost" size="icon" onClick={() => setDeletingConnection(samlConnection)} aria-label="Remove SAML 2.0"><Trash2 className="w-4 h-4" /></Button>
                </div>
              }
            >
              {samlEnabled && editingConnectionId === samlConnection.id ? (
                <div className="space-y-4">
                  <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                    <p className="text-xs text-info font-medium mb-1">Service Provider Details</p>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Entity ID:</span>{' '}
                        <code className="text-xs">https://api.releasea.io/auth/saml/metadata</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">ACS URL:</span>{' '}
                        <code className="text-xs">https://api.releasea.io/auth/saml/callback</code>
                      </p>
                    </div>
                  </div>

                  <SettingsGrid columns={2}>
                    <div className="space-y-2">
                      <Label htmlFor="saml-entity">IdP Entity ID (Issuer)</Label>
                      <Input
                        id="saml-entity"
                        value={samlEntityId}
                        onChange={(e) => setSamlEntityId(e.target.value)}
                        placeholder="https://sts.windows.net/{tenant-id}/"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="saml-sso">SSO URL</Label>
                      <Input
                        id="saml-sso"
                        value={samlSsoUrl}
                        onChange={(e) => setSamlSsoUrl(e.target.value)}
                        placeholder="https://login.microsoftonline.com/.../saml2"
                        className="font-mono text-sm"
                      />
                    </div>
                  </SettingsGrid>

                  <div className="space-y-2">
                    <Label htmlFor="saml-slo">Single Logout URL (optional)</Label>
                    <Input
                      id="saml-slo"
                      value={samlSloUrl}
                      onChange={(e) => setSamlSloUrl(e.target.value)}
                      placeholder="https://login.microsoftonline.com/.../saml2/logout"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="saml-cert">X.509 Certificate</Label>
                    <textarea
                      id="saml-cert"
                      value={samlCertificate}
                      onChange={(e) => setSamlCertificate(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      className="w-full h-24 bg-muted/40 border border-input rounded-md px-3 py-2 font-mono text-sm resize-none"
                    />
                  </div>

                  <SettingsGrid columns={3}>
                    <div className="space-y-2">
                      <Label>Signature Algorithm</Label>
                      <Select value={samlSignatureAlgorithm} onValueChange={(v) => setSamlSignatureAlgorithm(v as typeof samlSignatureAlgorithm)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sha256">SHA-256</SelectItem>
                          <SelectItem value="sha512">SHA-512</SelectItem>
                          <SelectItem value="sha1">SHA-1 (legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>NameID Format</Label>
                      <Select value={samlNameIdFormat} onValueChange={(v) => setSamlNameIdFormat(v as typeof samlNameIdFormat)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emailAddress">Email Address</SelectItem>
                          <SelectItem value="persistent">Persistent</SelectItem>
                          <SelectItem value="transient">Transient</SelectItem>
                          <SelectItem value="unspecified">Unspecified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sign AuthnRequests</Label>
                      <div className="flex items-center h-9">
                        <Switch checked={samlWantSigned} onCheckedChange={setSamlWantSigned} />
                      </div>
                    </div>
                  </SettingsGrid>

                  <div className="flex items-center justify-between pt-2">
                    <a
                      href="https://docs.microsoft.com/azure/active-directory"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Microsoft Entra ID Documentation
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('saml')}
                      disabled={isTesting || !samlEntityId || !samlSsoUrl}
                    >
                      {isTesting ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                  <div className="flex justify-end border-t border-border/60 pt-4">
                    <Button onClick={() => handleSaveConnection(samlConnection)} disabled={isSaving || !config}>
                      {isSaving ? 'Saving...' : 'Save SAML provider'}
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Shield className="text-muted-foreground/50" />}
                  title={samlEnabled ? 'SAML provider ready to edit' : 'SAML provider is disabled'}
                  description={samlEnabled ? 'Select Edit to review or change this connection.' : 'Enable this provider to configure and save the connection.'}
                  tone="muted"
                  className="py-8"
                />
              )}
            </SettingsSection>
            )}

            {/* OIDC Section */}
            {oidcConnection && editingConnectionId === oidcConnection.id && (
            <SettingsSection
              title={oidcConnection.name}
              description="Connect via OAuth 2.0 / OIDC protocol"
              actions={
                <div className="flex items-center gap-2">
                  {oidcEnabled && <Badge variant="secondary" className="text-xs">ENABLED</Badge>}
                  <Switch checked={oidcEnabled} onCheckedChange={(enabled) => handleConnectionToggle(oidcConnection, enabled)} aria-label="Enable OpenID Connect" />
                  <Button variant="ghost" size="icon" onClick={() => setDeletingConnection(oidcConnection)} aria-label="Remove OpenID Connect"><Trash2 className="w-4 h-4" /></Button>
                </div>
              }
            >
              {oidcEnabled && editingConnectionId === oidcConnection.id ? (
                <div className="space-y-4">
                  <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                    <p className="text-xs text-info font-medium mb-1">Redirect URI</p>
                    <code className="text-xs text-foreground">{oidcRedirectUri}</code>
                  </div>

                  <SettingsGrid columns={2}>
                    <div className="space-y-2">
                      <Label htmlFor="oidc-issuer">Issuer URL</Label>
                      <Input
                        id="oidc-issuer"
                        value={oidcIssuer}
                        onChange={(e) => setOidcIssuer(e.target.value)}
                        placeholder="https://auth.example.com/realms/your-realm"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oidc-client">Client ID</Label>
                      <Input
                        id="oidc-client"
                        value={oidcClientId}
                        onChange={(e) => setOidcClientId(e.target.value)}
                        placeholder="releasea-client"
                        className="font-mono text-sm"
                      />
                    </div>
                  </SettingsGrid>

                  <SettingsGrid columns={2}>
                    <div className="space-y-2">
                      <Label htmlFor="oidc-secret">Client Secret</Label>
                      <Input
                        id="oidc-secret"
                        type="password"
                        value={oidcClientSecret}
                        onChange={(e) => setOidcClientSecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oidc-scopes">Scopes</Label>
                      <Input
                        id="oidc-scopes"
                        value={oidcScopes}
                        onChange={(e) => setOidcScopes(e.target.value)}
                        placeholder="openid profile email groups"
                        className="font-mono text-sm"
                      />
                    </div>
                  </SettingsGrid>

                  <div className="space-y-2">
                    <Label>Token Endpoint Authentication</Label>
                    <Select value={oidcTokenAuth} onValueChange={(v) => setOidcTokenAuth(v as typeof oidcTokenAuth)}>
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client_secret_post">Client Secret (POST)</SelectItem>
                        <SelectItem value="client_secret_basic">Client Secret (Basic)</SelectItem>
                        <SelectItem value="private_key_jwt">Private Key JWT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <a
                      href="https://openid.net/developers/how-connect-works/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      OpenID Connect Specification
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('oidc')}
                      disabled={isTesting || !oidcIssuer || !oidcClientId}
                    >
                      {isTesting ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                  <div className="flex justify-end border-t border-border/60 pt-4">
                    <Button onClick={() => handleSaveConnection(oidcConnection)} disabled={isSaving || !config}>
                      {isSaving ? 'Saving...' : 'Save OIDC provider'}
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Key className="text-muted-foreground/50" />}
                  title={oidcEnabled ? 'OpenID Connect provider ready to edit' : 'OpenID Connect provider is disabled'}
                  description={oidcEnabled ? 'Select Edit to review or change this connection.' : 'Enable this provider to configure and save the connection.'}
                  tone="muted"
                  className="py-8"
                />
              )}
            </SettingsSection>
            )}

          </TabsContent>

          {/* Provisioning Tab */}
          <TabsContent value="provisioning" className="space-y-6">
            <SettingsSection
              title="User Provisioning"
              description="Control how users are created and removed"
              status={atomicSaveStatus}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-provision users</p>
                    <p className="text-xs text-muted-foreground">Automatically create users on first login</p>
                  </div>
                  <Switch checked={autoProvision} onCheckedChange={(checked) => {
                    setAutoProvision(checked);
                    void persistAtomicConfig('provisioning', { autoProvision: checked });
                  }} />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-deprovision users</p>
                    <p className="text-xs text-muted-foreground">Remove users when they are removed from IdP</p>
                  </div>
                  <Switch checked={autoDeprovision} onCheckedChange={(checked) => {
                    setAutoDeprovision(checked);
                    void persistAtomicConfig('provisioning', { autoDeprovision: checked });
                  }} />
                </div>

                <div className="pt-2 border-t border-border/50">
                  <SettingsGrid columns={2}>
                    <div className="space-y-2">
                      <Label>Default Role</Label>
                      <Select value={defaultRole} onValueChange={(v) => {
                        const role = v as IdpRole;
                        setDefaultRole(role);
                        void persistAtomicConfig('provisioning', { defaultRole: role });
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Role assigned to new users without a group mapping</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Sync Interval (minutes)</Label>
                      <Input
                        type="number"
                        value={syncInterval}
                        onChange={(e) => setSyncInterval(Number(e.target.value))}
                        onBlur={() => void persistAtomicConfig('provisioning', { syncInterval })}
                        min={5}
                        max={1440}
                      />
                      <p className="text-xs text-muted-foreground">How often to sync with IdP (5-1440 min)</p>
                    </div>
                  </SettingsGrid>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Session Settings"
              description="Configure session duration and behavior"
              status={atomicSaveStatus}
            >
              <div className="space-y-4">
                <SettingsGrid columns={2}>
                  <div className="space-y-2">
                    <Label>Session Duration (hours)</Label>
                    <Input
                      type="number"
                      value={Math.round(sessionMaxAge / 3600)}
                      onChange={(e) => setSessionMaxAge(Number(e.target.value) * 3600)}
                      onBlur={() => void persistAtomicConfig('session', { maxAge: sessionMaxAge })}
                      min={1}
                      max={720}
                    />
                    <p className="text-xs text-muted-foreground">Maximum session lifetime</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Idle Timeout (minutes)</Label>
                    <Input
                      type="number"
                      value={Math.round(sessionIdleTimeout / 60)}
                      onChange={(e) => setSessionIdleTimeout(Number(e.target.value) * 60)}
                      onBlur={() => void persistAtomicConfig('session', { idleTimeout: sessionIdleTimeout })}
                      min={5}
                      max={480}
                    />
                    <p className="text-xs text-muted-foreground">Time before inactive session expires</p>
                  </div>
                </SettingsGrid>

                <div className="flex items-center justify-between py-2 border-t border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Single Logout (SLO)</p>
                    <p className="text-xs text-muted-foreground">Sign out from IdP when logging out of platform</p>
                  </div>
                  <Switch checked={singleLogout} onCheckedChange={(checked) => {
                    setSingleLogout(checked);
                    void persistAtomicConfig('session', { singleLogout: checked });
                  }} />
                </div>
              </div>
            </SettingsSection>

          </TabsContent>

          {/* Mappings Tab */}
          <TabsContent value="mappings" className="space-y-6">
            <SettingsSection
              title="Group Mappings"
              description="Map IdP groups to platform teams and roles"
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncMappings}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button size="sm" onClick={() => setMappingModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Add Mapping
                  </Button>
                </div>
              }
            >
              {groupMappings.length === 0 ? (
                <EmptyState
                  icon={<FileText className="text-muted-foreground/50" />}
                  title="No group mappings configured"
                  description="Map IdP groups to platform teams to auto-assign roles"
                  tone="muted"
                  className="py-8"
                />
              ) : (
                <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.5fr_1.5fr_1fr_0.8fr_auto] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border/50 bg-muted/30">
                    <span>IdP Group</span>
                    <span>Platform Team</span>
                    <span>Role</span>
                    <span>Members</span>
                    <span className="w-8" />
                  </div>
                  <div className="divide-y divide-border/40">
                    {groupMappings.map((mapping) => (
                      <div key={mapping.id} className="grid grid-cols-[1.5fr_1.5fr_1fr_0.8fr_auto] gap-4 items-center px-4 py-3">
                        <span className="text-sm font-mono text-foreground truncate">{mapping.externalGroup}</span>
                        <span className="text-sm text-foreground truncate">{mapping.internalTeamName}</span>
                        <Badge variant="outline" className={`w-fit ${roleColors[mapping.role]}`}>
                          {getRoleLabel(mapping.role)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{mapping.memberCount}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMapping(mapping.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SettingsSection>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <SettingsSection
              title="Active Sessions"
              description="View and manage user sessions authenticated via IdP"
            >
              {sessions.length === 0 ? (
                <EmptyState
                  icon={<Activity className="text-muted-foreground/50" />}
                  title="No active sessions"
                  description="Sessions will appear here when users sign in via IdP"
                  tone="muted"
                  className="py-8"
                />
              ) : (
                <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  <div className="divide-y divide-border/40">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full ${session.active ? 'bg-success' : 'bg-muted'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {sanitizeTextForRender(session.userName, { maxLength: 80 })}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{maskEmail(session.userEmail)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">{maskIPAddress(session.ipAddress)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(session.lastActivity)}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {session.provider.toUpperCase()}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SettingsSection>

            <SettingsSection title="Audit Log" description="Recent authentication events">
              {auditLogs.length === 0 ? (
                <EmptyState
                  icon={<FileText className="text-muted-foreground/50" />}
                  title="No audit logs"
                  description="Authentication events will be logged here"
                  tone="muted"
                  className="py-8"
                />
              ) : (
                <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  <div className="divide-y divide-border/40">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="mt-0.5">{getAuditIcon(log.action)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {redactSensitiveText(log.details, {
                              maskEmails: true,
                              maskIPs: true,
                              maxLength: 200,
                            })}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{formatDate(log.timestamp)}</span>
                            {log.userName && (
                              <>
                                <span>•</span>
                                <span>{sanitizeTextForRender(log.userName, { maxLength: 80 })}</span>
                              </>
                            )}
                            {log.ipAddress && (
                              <>
                                <span>•</span>
                                <span>{maskIPAddress(log.ipAddress)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SettingsSection>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <SettingsSection
              title="Authentication Security"
              description="Additional security requirements for IdP users"
              status={atomicSaveStatus}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Require MFA</p>
                    <p className="text-xs text-muted-foreground">Users must have MFA enabled at the IdP level</p>
                  </div>
                  <Switch checked={requireMfa} onCheckedChange={(checked) => {
                    setRequireMfa(checked);
                    void persistAtomicConfig('security', { requireMfa: checked });
                  }} />
                </div>

                <div className="pt-2 border-t border-border/50 space-y-2">
                  <Label htmlFor="allowed-domains">Allowed Email Domains</Label>
                  <Input
                    id="allowed-domains"
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
                    onBlur={() => void persistAtomicConfig('security', {
                      allowedDomains: allowedDomains.split(/[\s,]+/).filter(Boolean),
                    })}
                    placeholder="company.com, subsidiary.com"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of domains. Leave empty to allow all.
                  </p>
                </div>
              </div>
            </SettingsSection>

            <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Security Recommendations</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>• Enable MFA requirement for all IdP users</li>
                    <li>• Restrict allowed domains to your organization</li>
                    <li>• Use SHA-256 or higher for SAML signatures</li>
                    <li>• Regularly review and revoke inactive sessions</li>
                    <li>• Enable auto-deprovision to remove departed users</li>
                  </ul>
                </div>
              </div>
            </div>

          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Add identity provider</DialogTitle>
            <DialogDescription>
              Choose the protocol supported by your identity platform. You can configure the connection after selecting it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            {([
              {
                protocol: 'saml' as const,
                title: 'SAML 2.0',
                description: 'Enterprise SSO for Microsoft Entra ID, Okta, Google Workspace, and similar providers.',
                icon: Shield,
              },
              {
                protocol: 'oidc' as const,
                title: 'OpenID Connect',
                description: 'Modern OAuth-based SSO for Keycloak, Auth0, Okta, and custom identity services.',
                icon: Key,
              },
            ]).map((option) => {
              const alreadyAdded = connections.some((connection) => connection.protocol === option.protocol);
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.protocol}
                  type="button"
                  onClick={() => handleAddConnection(option.protocol)}
                  className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <OptionIcon className="h-6 w-6" />
                    </div>
                    {alreadyAdded && <Badge variant="secondary">Already added</Badge>}
                  </div>
                  <p className="mt-4 font-semibold text-foreground">{option.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
                  <p className="mt-4 text-sm font-medium text-primary">
                    {alreadyAdded ? 'Open configuration' : 'Select provider'}
                  </p>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProviderOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingConnection)} onOpenChange={(open) => !open && setDeletingConnection(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Remove identity provider?</DialogTitle>
            <DialogDescription>
              {deletingConnection?.name} will no longer be available for sign-in. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingConnection(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConnection}>Remove provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mapping Modal */}
      <Dialog open={mappingModalOpen} onOpenChange={setMappingModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Group Mapping</DialogTitle>
            <DialogDescription>
              Map an external IdP group to a platform team and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="mapping-group">IdP Group Name</Label>
              <Input
                id="mapping-group"
                value={mappingGroup}
                onChange={(e) => setMappingGroup(e.target.value)}
                placeholder="platform-admins"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Platform Team</Label>
              <Select value={mappingTeamId} onValueChange={setMappingTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Role</Label>
              <Select value={mappingRole} onValueChange={(v) => setMappingRole(v as IdpRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setMappingModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMapping}>Add Mapping</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default IdentityProvider;
