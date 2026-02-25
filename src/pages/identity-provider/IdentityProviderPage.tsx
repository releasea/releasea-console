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
} from '@/lib/idp-data';
import type { Team } from '@/types/releasea';
import type {
  IdentityProviderConfig,
  GroupMapping,
  IdpSession,
  IdpAuditLog,
  IdpRole,
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
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
      const [teamsData, configData, mappingsData, sessionsData, logsData] = await Promise.all([
        fetchTeams(),
        fetchIdpConfig(),
        fetchGroupMappings(),
        fetchIdpSessions(),
        fetchIdpAuditLogs(),
      ]);
      if (!active) return;

      setTeams(teamsData);
      setConfig(configData);
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

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);

    const nextConfig: IdentityProviderConfig = {
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

    await updateIdpConfig(nextConfig);
    setConfig(nextConfig);
    setIsSaving(false);
    toast({ title: 'Settings saved', description: 'Identity provider configuration updated.' });
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <ListPageHeader
          title="Identity Provider"
          description="Configure SSO, user provisioning, and access management"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
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
            {/* SAML Section */}
            <SettingsSection
              title="SAML 2.0"
              description="Connect via Security Assertion Markup Language"
              actions={
                <div className="flex items-center gap-2">
                  {samlEnabled && <Badge variant="secondary" className="text-xs">ENABLED</Badge>}
                  <Switch checked={samlEnabled} onCheckedChange={setSamlEnabled} />
                </div>
              }
            >
              {samlEnabled ? (
                <div className="space-y-4">
                  <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                    <p className="text-xs text-info font-medium mb-1">Service Provider Details</p>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Entity ID:</span>{' '}
                        <code className="text-xs">https://api.releasea.dev/auth/saml/metadata</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">ACS URL:</span>{' '}
                        <code className="text-xs">https://api.releasea.dev/auth/saml/callback</code>
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
                </div>
              ) : (
                <EmptyState
                  icon={<Shield className="text-muted-foreground/50" />}
                  title="Enable SAML to allow enterprise SSO"
                  description="Users can sign in with their corporate identity"
                  tone="muted"
                  className="py-8"
                />
              )}
            </SettingsSection>

            {/* OIDC Section */}
            <SettingsSection
              title="OpenID Connect"
              description="Connect via OAuth 2.0 / OIDC protocol"
              actions={
                <div className="flex items-center gap-2">
                  {oidcEnabled && <Badge variant="secondary" className="text-xs">ENABLED</Badge>}
                  <Switch checked={oidcEnabled} onCheckedChange={setOidcEnabled} />
                </div>
              }
            >
              {oidcEnabled ? (
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
                </div>
              ) : (
                <EmptyState
                  icon={<Key className="text-muted-foreground/50" />}
                  title="Enable OpenID Connect for OAuth-based SSO"
                  description="Works with Okta, Auth0, Keycloak, and more"
                  tone="muted"
                  className="py-8"
                />
              )}
            </SettingsSection>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving || !config}>
                {isSaving ? 'Saving...' : 'Save Connection Settings'}
              </Button>
            </div>
          </TabsContent>

          {/* Provisioning Tab */}
          <TabsContent value="provisioning" className="space-y-6">
            <SettingsSection
              title="User Provisioning"
              description="Control how users are created and removed"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-provision users</p>
                    <p className="text-xs text-muted-foreground">Automatically create users on first login</p>
                  </div>
                  <Switch checked={autoProvision} onCheckedChange={setAutoProvision} />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-deprovision users</p>
                    <p className="text-xs text-muted-foreground">Remove users when they are removed from IdP</p>
                  </div>
                  <Switch checked={autoDeprovision} onCheckedChange={setAutoDeprovision} />
                </div>

                <div className="pt-2 border-t border-border/50">
                  <SettingsGrid columns={2}>
                    <div className="space-y-2">
                      <Label>Default Role</Label>
                      <Select value={defaultRole} onValueChange={(v) => setDefaultRole(v as IdpRole)}>
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
            >
              <div className="space-y-4">
                <SettingsGrid columns={2}>
                  <div className="space-y-2">
                    <Label>Session Duration (hours)</Label>
                    <Input
                      type="number"
                      value={Math.round(sessionMaxAge / 3600)}
                      onChange={(e) => setSessionMaxAge(Number(e.target.value) * 3600)}
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
                  <Switch checked={singleLogout} onCheckedChange={setSingleLogout} />
                </div>
              </div>
            </SettingsSection>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving || !config}>
                {isSaving ? 'Saving...' : 'Save Provisioning Settings'}
              </Button>
            </div>
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
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Require MFA</p>
                    <p className="text-xs text-muted-foreground">Users must have MFA enabled at the IdP level</p>
                  </div>
                  <Switch checked={requireMfa} onCheckedChange={setRequireMfa} />
                </div>

                <div className="pt-2 border-t border-border/50 space-y-2">
                  <Label htmlFor="allowed-domains">Allowed Email Domains</Label>
                  <Input
                    id="allowed-domains"
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
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

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving || !config}>
                {isSaving ? 'Saving...' : 'Save Security Settings'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

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
