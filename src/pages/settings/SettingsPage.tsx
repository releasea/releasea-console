import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Globe,
  Bell,
  Zap,
  Monitor,
  Clock,
  RotateCcw,
  KeyRound,
  GitBranch,
  Package,
  ShieldCheck,
  LayoutTemplate,
  Trash2,
  Bot,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsGrid, SettingsSection } from '@/components/layout/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { TableEmptyRow } from '@/components/layout/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  createRegistryCredential,
  createScmCredential,
  deleteRegistryCredential,
  deleteScmCredential,
  fetchPlatformSettings,
  fetchProviderCatalog,
  fetchProviderHealth,
  fetchProviderStatus,
  fetchProjects,
  fetchRegistryCredentials,
  fetchScmCredentials,
  fetchServices,
  fetchServiceTemplates,
  verifyServiceTemplates,
  createServiceTemplate,
  updateServiceTemplate,
  deleteServiceTemplate,
  updatePlatformSettings,
} from '@/lib/data';
import { usePlatformPreferences, type PlatformPreferences } from '@/contexts/PlatformPreferencesContext';
import type {
  CredentialScope,
  PlatformIntegration,
  ProviderCatalog,
  ProviderHealthCatalog,
  ProviderHealthCheck,
  ProviderDefinition,
  ProviderStatusCatalog,
  ProviderStatus,
  PlatformSettings,
  Project,
  RegistryCredential,
  ScmCredential,
  SecretProvider,
  SecretProviderType,
  Service,
  ServiceTemplate,
} from '@/types/releasea';
import {
  formatTemplateMode,
  formatTemplateSource,
  formatTemplateType,
  formatTemplateVerificationStatus,
  parseTemplateImport,
} from './template-utils';
import { AIProvidersSettings } from './AIProvidersSettings';

const SETTINGS_TABS = ['display', 'general', 'notifications', 'credentials', 'ai', 'templates', 'resources'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const normalizeSettingsTab = (value: string | null | undefined): SettingsTab =>
  SETTINGS_TABS.includes(value as SettingsTab) ? (value as SettingsTab) : 'display';

const STARTER_TEMPLATE_IMPORT = JSON.stringify(
  [
    {
      id: 'tpl-starter-microservice',
      type: 'microservice',
      label: 'Starter Microservice',
      description: 'Opinionated starter for HTTP APIs and internal services.',
      category: 'Services',
      owner: 'releasea',
      bestFor: 'Quick onboarding',
      defaults: 'Git repository, rolling deploy, health check',
      setupTime: '5 min',
      tier: 'starter',
      highlights: ['Rolling deploy', 'Health check', 'Safe defaults'],
      templateKind: 'service',
      repoMode: 'existing',
      allowTemplateToggle: true,
      templateDefaults: {
        sourceType: 'git',
        branch: 'main',
        port: '8080',
        healthCheckPath: '/healthz',
      },
    },
  ],
  null,
  2,
);

const SettingsPage = () => {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => normalizeSettingsTab(query.get('tab')));
  const [isSaving, setIsSaving] = useState(false);
  const { preferences, updatePreference, updatePreferences, resetPreferences } = usePlatformPreferences();

  // Organization settings
  const [orgName, setOrgName] = useState('Releasea');
  const [orgSlug, setOrgSlug] = useState('releasea');
  const [apiUrl, setApiUrl] = useState('https://api.releasea.io');

  // Notifications
  const [notifications, setNotifications] = useState({
    deploySuccess: true,
    deployFailed: true,
    serviceDown: true,
    workerOffline: true,
    highCpu: false,
    approvalRequired: true,
    approvalCompleted: true,
  });

  // Resource Limits
  const [resourceLimits, setResourceLimits] = useState({
    maxServicesPerProject: 50,
    maxReplicasPerService: 10,
    maxCpuPerReplica: 4,
    maxMemoryPerReplica: 8192,
    defaultReplicas: 2,
    defaultCpu: 0.5,
    defaultMemory: 512,
  });

  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalog | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthCatalog | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusCatalog | null>(null);
  const [isRunningProviderHealth, setIsRunningProviderHealth] = useState(false);
  const [secretProviders, setSecretProviders] = useState<SecretProvider[]>([]);
  const [defaultSecretProviderId, setDefaultSecretProviderId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [scmCredentials, setScmCredentials] = useState<ScmCredential[]>([]);
  const [registryCredentials, setRegistryCredentials] = useState<RegistryCredential[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);
  const [templateImportPayload, setTemplateImportPayload] = useState('');
  const [templateVerificationPreview, setTemplateVerificationPreview] = useState<ServiceTemplate[]>([]);
  const [isVerifyingTemplates, setIsVerifyingTemplates] = useState(false);
  const [isImportingTemplates, setIsImportingTemplates] = useState(false);
  const [scmName, setScmName] = useState('');
  const [scmProvider, setScmProvider] = useState('github');
  const [scmAuthType, setScmAuthType] = useState<'token' | 'ssh'>('token');
  const [scmToken, setScmToken] = useState('');
  const [scmPrivateKey, setScmPrivateKey] = useState('');
  const [scmScope, setScmScope] = useState<CredentialScope>('platform');
  const [scmProjectId, setScmProjectId] = useState('');
  const [scmServiceId, setScmServiceId] = useState('');
  const [scmNotes, setScmNotes] = useState('');
  const [isSavingScm, setIsSavingScm] = useState(false);

  const [registryName, setRegistryName] = useState('');
  const [registryProvider, setRegistryProvider] = useState('docker');
  const [registryUrl, setRegistryUrl] = useState('');
  const [registryUsername, setRegistryUsername] = useState('');
  const [registryPassword, setRegistryPassword] = useState('');
  const [registryScope, setRegistryScope] = useState<CredentialScope>('platform');
  const [registryProjectId, setRegistryProjectId] = useState('');
  const [registryServiceId, setRegistryServiceId] = useState('');
  const [registryNotes, setRegistryNotes] = useState('');
  const [isSavingRegistry, setIsSavingRegistry] = useState(false);

  const [secretProviderName, setSecretProviderName] = useState('');
  const [secretProviderType, setSecretProviderType] = useState<SecretProviderType>('vault');
  const [secretProviderNotes, setSecretProviderNotes] = useState('');
  const [secretVaultAddress, setSecretVaultAddress] = useState('');
  const [secretVaultToken, setSecretVaultToken] = useState('');
  const [secretAwsAccessKey, setSecretAwsAccessKey] = useState('');
  const [secretAwsSecretKey, setSecretAwsSecretKey] = useState('');
  const [secretAwsRegion, setSecretAwsRegion] = useState('us-east-1');
  const [secretGcpProjectId, setSecretGcpProjectId] = useState('');
  const [secretGcpServiceAccount, setSecretGcpServiceAccount] = useState('');

  useEffect(() => {
    setActiveTab(normalizeSettingsTab(query.get('tab')));
  }, [query]);

  useEffect(() => {
    if (activeTab !== 'credentials') return;
    const focus = new URLSearchParams(location.search).get('focus');
    const targetId =
      focus === 'scm'
        ? 'settings-scm-credential-form'
        : focus === 'registry'
          ? 'settings-registry-credential-form'
          : '';
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      const section = document.getElementById(targetId);
      if (!section) return;
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusTarget = section.querySelector<HTMLElement>('input, [role="combobox"], textarea');
      focusTarget?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeTab, location.search]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [data, catalog, status] = await Promise.all([
        fetchPlatformSettings(),
        fetchProviderCatalog(),
        fetchProviderStatus(),
      ]);
      if (!active) return;
      setProviderCatalog(catalog);
      setProviderStatus(status);
      setOrgName(data.organization?.name ?? '');
      setOrgSlug(data.organization?.slug ?? '');
      setApiUrl(data.organization?.apiUrl ?? '');
      setNotifications(prev => ({
        ...prev,
        deploySuccess: data.notifications?.deploySuccess ?? prev.deploySuccess,
        deployFailed: data.notifications?.deployFailed ?? prev.deployFailed,
        serviceDown: data.notifications?.serviceDown ?? prev.serviceDown,
        workerOffline: data.notifications?.workerOffline ?? prev.workerOffline,
        highCpu: data.notifications?.highCpu ?? prev.highCpu,
      }));
      setIntegrations(Array.isArray(data.integrations) ? data.integrations : []);
      setSecretProviders(Array.isArray(data.secrets?.providers) ? data.secrets?.providers ?? [] : []);
      setDefaultSecretProviderId(data.secrets?.defaultProviderId ?? '');
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!providerCatalog) return;

    const nextScmProvider =
      providerCatalog.scm.providers.find((provider) => provider.id === scmProvider)?.id ??
      providerCatalog.scm.defaultProvider ??
      providerCatalog.scm.providers[0]?.id;
    if (nextScmProvider && nextScmProvider !== scmProvider) {
      setScmProvider(nextScmProvider);
    }

    const nextRegistryProvider =
      providerCatalog.registry.providers.find((provider) => provider.id === registryProvider)?.id ??
      providerCatalog.registry.defaultProvider ??
      providerCatalog.registry.providers[0]?.id;
    if (nextRegistryProvider && nextRegistryProvider !== registryProvider) {
      setRegistryProvider(nextRegistryProvider);
    }

    const nextSecretProvider =
      providerCatalog.secrets.providers.find((provider) => provider.id === secretProviderType)?.id ??
      providerCatalog.secrets.defaultProvider ??
      providerCatalog.secrets.providers[0]?.id;
    if (nextSecretProvider && nextSecretProvider !== secretProviderType) {
      setSecretProviderType(nextSecretProvider as SecretProviderType);
    }
  }, [providerCatalog, registryProvider, scmProvider, secretProviderType]);

  useEffect(() => {
    let active = true;
    const loadCredentials = async () => {
      const [projectsData, servicesData, scmData, registryData, templatesData] = await Promise.all([
        fetchProjects(),
        fetchServices(),
        fetchScmCredentials(),
        fetchRegistryCredentials(),
        fetchServiceTemplates(),
      ]);
      if (!active) return;
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setScmCredentials(Array.isArray(scmData) ? scmData : []);
      setRegistryCredentials(Array.isArray(registryData) ? registryData : []);
      setServiceTemplates(Array.isArray(templatesData) ? templatesData : []);
    };
    loadCredentials();
    return () => {
      active = false;
    };
  }, []);

  const resolveProjectName = (projectId?: string) =>
    projects.find((project) => project.id === projectId)?.name ?? 'Unknown project';

  const resolveServiceName = (serviceId?: string) =>
    services.find((service) => service.id === serviceId)?.name ?? 'Unknown service';

  const scopeLabel = (scope: CredentialScope) => {
    if (scope === 'project') return 'Project';
    if (scope === 'service') return 'Service';
    return 'Platform';
  };

  const formatCredentialTarget = (scope: CredentialScope, projectId?: string, serviceId?: string) => {
    if (scope === 'project') return resolveProjectName(projectId);
    if (scope === 'service') return resolveServiceName(serviceId);
    return 'All projects';
  };

  const credentialIdFromDocument = (value: { id?: string; _id?: string | { $oid?: string } }): string => {
    if (typeof value.id === 'string' && value.id.trim()) {
      return value.id.trim();
    }
    if (typeof value._id === 'string' && value._id.trim()) {
      return value._id.trim();
    }
    if (value._id && typeof value._id === 'object' && typeof value._id.$oid === 'string' && value._id.$oid.trim()) {
      return value._id.$oid.trim();
    }
    return '';
  };

  const formatCapabilityLabel = (value: string) =>
    value
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const providerStatusSections = providerStatus
    ? [
        providerStatus.scm,
        providerStatus.registry,
        providerStatus.secrets,
        providerStatus.identity,
        providerStatus.notifications,
      ]
    : [];
  const providerHealthSections = providerHealth
    ? [
        providerHealth.scm,
        providerHealth.registry,
        providerHealth.secrets,
        providerHealth.identity,
        providerHealth.notifications,
      ]
    : [];

  const resolveProviderStatus = (kind: 'scm' | 'registry' | 'secrets' | 'identity' | 'notifications', providerId?: string) =>
    providerStatus?.[kind].providers.find((provider) => provider.id === providerId) ?? null;
  const resolveCatalogProviderStatus = (kind: ProviderCatalog['scm']['kind'], providerId: string) =>
    providerStatusSections.find((section) => section.kind === kind)?.providers.find((provider) => provider.id === providerId) ?? null;

  const formatProviderState = (state: ProviderStatus['state']) =>
    state
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const providerStateBadgeClass = (state: ProviderStatus['state']) => {
    if (state === 'configured') return 'border-success/30 bg-success/10 text-success';
    if (state === 'partial') return 'border-warning/30 bg-warning/10 text-warning';
    if (state === 'disabled') return 'border-border/60 bg-muted/30 text-muted-foreground';
    return 'border-border/60 bg-muted/30 text-muted-foreground';
  };

  const formatProviderHealthState = (state: ProviderHealthCheck['state']) =>
    state
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const providerHealthBadgeClass = (state: ProviderHealthCheck['state']) => {
    if (state === 'healthy') return 'border-success/30 bg-success/10 text-success';
    if (state === 'unhealthy') return 'border-destructive/30 bg-destructive/10 text-destructive';
    if (state === 'unsupported') return 'border-warning/30 bg-warning/10 text-warning';
    return 'border-border/60 bg-muted/30 text-muted-foreground';
  };

  const selectedScmProviderMeta =
    providerCatalog?.scm.providers.find((provider) => provider.id === scmProvider) ?? null;
  const selectedRegistryProviderMeta =
    providerCatalog?.registry.providers.find((provider) => provider.id === registryProvider) ?? null;
  const selectedSecretProviderMeta =
    providerCatalog?.secrets.providers.find((provider) => provider.id === secretProviderType) ?? null;
  const selectedScmProviderStatus = resolveProviderStatus('scm', scmProvider);
  const selectedRegistryProviderStatus = resolveProviderStatus('registry', registryProvider);
  const selectedSecretProviderStatus = resolveProviderStatus('secrets', secretProviderType);
  const providerCatalogSections = providerCatalog
    ? [
        providerCatalog.scm,
        providerCatalog.registry,
        providerCatalog.secrets,
        providerCatalog.identity,
        providerCatalog.notifications,
      ]
    : [];

  const renderProviderMeta = (provider: ProviderDefinition | null, status: ProviderStatus | null, emptyMessage: string) => (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      {status ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${providerStateBadgeClass(status.state)}`}>
            {formatProviderState(status.state)}
          </Badge>
          {status.default ? (
            <Badge variant="outline" className="text-[10px]">
              Default
            </Badge>
          ) : null}
          {typeof status.resourceCount === 'number' && status.resourceCount > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {status.resourceCount} configured
            </Badge>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {provider?.description ?? emptyMessage}
      </p>
      {status?.message ? (
        <p className="text-xs text-muted-foreground/90">
          {status.message}
        </p>
      ) : null}
      {provider?.authModes?.length ? (
        <div className="flex flex-wrap gap-2">
          {provider.authModes.map((mode) => (
            <Badge key={mode} variant="outline" className="text-[10px]">
              Auth: {formatCapabilityLabel(mode)}
            </Badge>
          ))}
        </div>
      ) : null}
      {provider?.configFields?.length ? (
        <div className="flex flex-wrap gap-2">
          {provider.configFields.map((field) => (
            <Badge key={field} variant="outline" className="text-[10px]">
              Config: {formatCapabilityLabel(field)}
            </Badge>
          ))}
        </div>
      ) : null}
      {provider?.capabilities?.length ? (
        <div className="flex flex-wrap gap-2">
          {provider.capabilities.map((capability) => (
            <Badge key={capability} variant="outline" className="text-[10px]">
              {formatCapabilityLabel(capability)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );

  const refreshCredentials = async () => {
    const [scmData, registryData] = await Promise.all([
      fetchScmCredentials(),
      fetchRegistryCredentials(),
    ]);
    setScmCredentials(Array.isArray(scmData) ? scmData : []);
    setRegistryCredentials(Array.isArray(registryData) ? registryData : []);
    setProviderHealth(null);
    const status = await fetchProviderStatus();
    setProviderStatus(status);
  };

  const refreshProviderStatus = async () => {
    setProviderHealth(null);
    const status = await fetchProviderStatus();
    setProviderStatus(status);
  };

  const handleRunProviderHealthChecks = async () => {
    setIsRunningProviderHealth(true);
    const health = await fetchProviderHealth();
    setProviderHealth(health);
    setIsRunningProviderHealth(false);

    const categories = [health.scm, health.registry, health.secrets, health.identity, health.notifications];
    const healthy = categories.reduce((sum, category) => sum + category.healthy, 0);
    const unhealthy = categories.reduce((sum, category) => sum + category.unhealthy, 0);
    toast({
      title: 'Provider health checks completed',
      description: `${healthy} healthy, ${unhealthy} unhealthy.`,
    });
  };

  const refreshTemplates = async () => {
    const templatesData = await fetchServiceTemplates();
    setServiceTemplates(Array.isArray(templatesData) ? templatesData : []);
  };

  const parseImportedTemplates = () => {
    if (!templateImportPayload.trim()) {
      toast({ title: 'Missing template payload', description: 'Paste a YAML or JSON template to verify or import.' });
      return null;
    }
    try {
      const templates = parseTemplateImport(templateImportPayload.trim());
      if (templates.length === 0) {
        toast({ title: 'No templates found', description: 'Provide at least one template definition.' });
        return null;
      }
      return templates;
    } catch {
      toast({ title: 'Invalid template payload', description: 'Check the YAML or JSON format and try again.' });
      return null;
    }
  };

  const handleVerifyTemplates = async () => {
    const templates = parseImportedTemplates();
    if (!templates) return;
    setIsVerifyingTemplates(true);
    const preview = await verifyServiceTemplates(templates);
    setTemplateVerificationPreview(Array.isArray(preview) ? preview : []);
    setIsVerifyingTemplates(false);
    const verified = preview.filter((template) => template.verification?.status === 'verified').length;
    const invalid = preview.filter((template) => template.verification?.status === 'invalid').length;
    toast({
      title: 'Template verification completed',
      description: `${verified} verified, ${invalid} invalid.`,
    });
  };

  const handleImportTemplates = async () => {
    const templates = parseImportedTemplates();
    if (!templates) return;

    setIsImportingTemplates(true);
    const existing = new Set(serviceTemplates.map((template) => template.id));
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const template of templates) {
      const templateId = (template.id || '').trim();
      const templateLabel = (template.label || '').trim();
      const templateType = (template.type || '').trim();
      if (!templateId || !templateLabel || !templateType) {
        failed += 1;
        continue;
      }
      if (existing.has(templateId)) {
        const result = await updateServiceTemplate(templateId, template);
        if (result) {
          updated += 1;
        } else {
          failed += 1;
        }
        continue;
      }
      const result = await createServiceTemplate(template);
      if (result) {
        created += 1;
      } else {
        failed += 1;
      }
    }

    await refreshTemplates();
    setIsImportingTemplates(false);

    if (created + updated > 0) {
      setTemplateImportPayload('');
      setTemplateVerificationPreview([]);
    }
    if (failed > 0) {
      toast({
        title: 'Templates imported with warnings',
        description: `${created} created, ${updated} updated, ${failed} failed.`,
      });
      return;
    }
    toast({
      title: 'Templates imported',
      description: `${created} created, ${updated} updated.`,
    });
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const ok = await deleteServiceTemplate(templateId);
    if (!ok) {
      toast({ title: 'Failed to delete template', description: 'Try again or check the API logs.' });
      return;
    }
    await refreshTemplates();
    toast({ title: 'Template deleted', description: 'Template removed from the catalog.' });
  };

  const buildSecretProviderConfig = () => {
    if (secretProviderType === 'vault') {
      return {
        address: secretVaultAddress.trim(),
        token: secretVaultToken.trim(),
      };
    }
    if (secretProviderType === 'aws') {
      return {
        accessKeyId: secretAwsAccessKey.trim(),
        secretAccessKey: secretAwsSecretKey.trim(),
        region: secretAwsRegion.trim(),
      };
    }
    return {
      projectId: secretGcpProjectId.trim(),
      serviceAccountJson: secretGcpServiceAccount.trim(),
    };
  };

  const handleAddSecretProvider = () => {
    if (!secretProviderName.trim()) {
      toast({ title: 'Missing name', description: 'Provide a name for the secret provider.' });
      return;
    }
    if (secretProviderType === 'vault' && (!secretVaultAddress.trim() || !secretVaultToken.trim())) {
      toast({ title: 'Missing Vault config', description: 'Provide Vault address and token.' });
      return;
    }
    if (secretProviderType === 'aws' && (!secretAwsAccessKey.trim() || !secretAwsSecretKey.trim())) {
      toast({ title: 'Missing AWS config', description: 'Provide AWS access key and secret.' });
      return;
    }
    if (secretProviderType === 'gcp' && (!secretGcpServiceAccount.trim() || !secretGcpProjectId.trim())) {
      toast({ title: 'Missing GCP config', description: 'Provide GCP project and service account JSON.' });
      return;
    }

    const now = new Date().toISOString();
    const next: SecretProvider = {
      id: `sp-${Date.now()}`,
      name: secretProviderName.trim(),
      type: secretProviderType,
      status: 'connected',
      config: buildSecretProviderConfig(),
      createdAt: now,
      updatedAt: now,
      notes: secretProviderNotes.trim(),
    };

    setSecretProviders((current) => [...current, next]);
    if (!defaultSecretProviderId) {
      setDefaultSecretProviderId(next.id);
    }
    setSecretProviderName('');
    setSecretProviderNotes('');
    setSecretVaultAddress('');
    setSecretVaultToken('');
    setSecretAwsAccessKey('');
    setSecretAwsSecretKey('');
    setSecretGcpProjectId('');
    setSecretGcpServiceAccount('');
    toast({ title: 'Provider added', description: 'Remember to save all changes.' });
  };

  const handleRemoveSecretProvider = (id: string) => {
    setSecretProviders((current) => current.filter((provider) => provider.id !== id));
    if (defaultSecretProviderId === id) {
      setDefaultSecretProviderId('');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload: PlatformSettings = {
      organization: { name: orgName, slug: orgSlug, apiUrl },
      database: { mongoUri: '', rabbitUrl: '' },
      identity: {
        saml: { enabled: false, entityId: '', ssoUrl: '', certificate: '' },
        keycloak: { enabled: false, url: '', realm: '', clientId: '', clientSecret: '' },
      },
      notifications: {
        deploySuccess: notifications.deploySuccess,
        deployFailed: notifications.deployFailed,
        serviceDown: notifications.serviceDown,
        workerOffline: notifications.workerOffline,
        highCpu: notifications.highCpu,
      },
      security: { require2fa: false, ipAllowlist: false, auditLogs: true },
      integrations,
      secrets: {
        defaultProviderId: defaultSecretProviderId,
        providers: secretProviders,
      },
    };
    await updatePlatformSettings(payload);
    setIsSaving(false);
    await refreshProviderStatus();
    toast({
      title: 'Settings saved',
      description: 'Your platform settings have been updated.',
    });
  };

  const handleResetPreferences = () => {
    resetPreferences();
    toast({
      title: 'Preferences reset',
      description: 'Display preferences have been reset to defaults.',
    });
  };

  const handleCreateScmCredential = async () => {
    if (!scmName.trim()) {
      toast({ title: 'Missing name', description: 'Provide a name for this SCM credential.' });
      return;
    }
    if (scmAuthType === 'token' && !scmToken.trim()) {
      toast({ title: 'Missing token', description: 'Provide a token for SCM access.' });
      return;
    }
    if (scmAuthType === 'ssh' && !scmPrivateKey.trim()) {
      toast({ title: 'Missing private key', description: 'Provide the SSH private key for SCM access.' });
      return;
    }
    if (scmScope === 'project' && !scmProjectId) {
      toast({ title: 'Select a project', description: 'Project scope requires a project.' });
      return;
    }
    if (scmScope === 'service' && !scmServiceId) {
      toast({ title: 'Select a service', description: 'Service scope requires a service.' });
      return;
    }
    setIsSavingScm(true);
    await createScmCredential({
      name: scmName.trim(),
      provider: scmProvider,
      authType: scmAuthType,
      token: scmAuthType === 'token' ? scmToken : undefined,
      privateKey: scmAuthType === 'ssh' ? scmPrivateKey : undefined,
      scope: scmScope,
      projectId: scmScope === 'project' ? scmProjectId : '',
      serviceId: scmScope === 'service' ? scmServiceId : '',
      notes: scmNotes.trim(),
    });
    setScmName('');
    setScmToken('');
    setScmPrivateKey('');
    setScmNotes('');
    setScmScope('platform');
    setScmProjectId('');
    setScmServiceId('');
    setIsSavingScm(false);
    await refreshCredentials();
    toast({ title: 'SCM credential added', description: 'Credential stored successfully.' });
  };

  const handleCreateRegistryCredential = async () => {
    if (!registryName.trim()) {
      toast({ title: 'Missing name', description: 'Provide a name for this registry credential.' });
      return;
    }
    if (!registryUsername.trim() || !registryPassword.trim()) {
      toast({ title: 'Missing credentials', description: 'Provide registry username and password.' });
      return;
    }
    if (registryScope === 'project' && !registryProjectId) {
      toast({ title: 'Select a project', description: 'Project scope requires a project.' });
      return;
    }
    if (registryScope === 'service' && !registryServiceId) {
      toast({ title: 'Select a service', description: 'Service scope requires a service.' });
      return;
    }
    setIsSavingRegistry(true);
    await createRegistryCredential({
      name: registryName.trim(),
      provider: registryProvider.trim(),
      registryUrl: registryUrl.trim(),
      username: registryUsername.trim(),
      password: registryPassword,
      scope: registryScope,
      projectId: registryScope === 'project' ? registryProjectId : '',
      serviceId: registryScope === 'service' ? registryServiceId : '',
      notes: registryNotes.trim(),
    });
    setRegistryName('');
    setRegistryUrl('');
    setRegistryUsername('');
    setRegistryPassword('');
    setRegistryNotes('');
    setRegistryScope('platform');
    setRegistryProjectId('');
    setRegistryServiceId('');
    setIsSavingRegistry(false);
    await refreshCredentials();
    toast({ title: 'Registry credential added', description: 'Credential stored successfully.' });
  };

  const handleDeleteScmCredential = async (credential: ScmCredential) => {
    const credentialId = credentialIdFromDocument(credential);
    if (!credentialId) {
      toast({ title: 'Unable to delete', description: 'Credential identifier not found.', variant: 'destructive' });
      return;
    }
    const success = await deleteScmCredential(credentialId);
    if (!success) {
      toast({ title: 'Failed to delete SCM credential', description: 'Try again or check API logs.', variant: 'destructive' });
      return;
    }
    await refreshCredentials();
    toast({ title: 'SCM credential deleted', description: 'Credential removed successfully.' });
  };

  const handleDeleteRegistryCredential = async (credential: RegistryCredential) => {
    const credentialId = credentialIdFromDocument(credential);
    if (!credentialId) {
      toast({ title: 'Unable to delete', description: 'Credential identifier not found.', variant: 'destructive' });
      return;
    }
    const success = await deleteRegistryCredential(credentialId);
    if (!success) {
      toast({ title: 'Failed to delete registry credential', description: 'Try again or check API logs.', variant: 'destructive' });
      return;
    }
    await refreshCredentials();
    toast({ title: 'Registry credential deleted', description: 'Credential removed successfully.' });
  };

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <ListPageHeader
          title="Platform Settings"
          description="Configure your Releasea instance"
        />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(normalizeSettingsTab(value))} className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="display" className="gap-2">
              <Monitor className="w-4 h-4" />
              Display
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Globe className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-2">
              <KeyRound className="w-4 h-4" />
              Credentials
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="w-4 h-4" />
              AI assistants
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-2">
              <Zap className="w-4 h-4" />
              Resources
            </TabsTrigger>
          </TabsList>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-6">
            <SettingsSection
              title="Interface preferences"
              description="Customize the platform appearance and behavior"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Compact view</p>
                    <p className="text-xs text-muted-foreground">Reduce spacing for denser information display</p>
                  </div>
                  <Switch
                    checked={preferences.compactView}
                    onCheckedChange={(checked) => updatePreference('compactView', checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sidebar collapsed by default</p>
                    <p className="text-xs text-muted-foreground">Start with the sidebar in collapsed state</p>
                  </div>
                  <Switch
                    checked={preferences.sidebarCollapsed}
                    onCheckedChange={(checked) => updatePreference('sidebarCollapsed', checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Default landing page</p>
                    <p className="text-xs text-muted-foreground">Page shown after login</p>
                  </div>
                  <Select
                    value={preferences.defaultLandingPage}
                    onValueChange={(value) => updatePreference('defaultLandingPage', value as PlatformPreferences['defaultLandingPage'])}
                  >
                    <SelectTrigger className="w-40 bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/">Dashboard</SelectItem>
                      <SelectItem value="/projects">Projects</SelectItem>
                      <SelectItem value="/services">Services</SelectItem>
                      <SelectItem value="/workers">Workers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Metrics and charts"
              description="Configure how metrics are displayed and refreshed"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-refresh metrics</p>
                    <p className="text-xs text-muted-foreground">Automatically update metrics charts</p>
                  </div>
                  <Switch
                    checked={preferences.autoRefreshMetrics}
                    onCheckedChange={(checked) => updatePreference('autoRefreshMetrics', checked)}
                  />
                </div>
                <div className="space-y-2 max-w-xs">
                  <Label>Refresh interval (seconds)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={preferences.metricsRefreshInterval}
                    onChange={(e) => updatePreference('metricsRefreshInterval', Math.max(10, parseInt(e.target.value) || 30))}
                    className="bg-muted/40"
                    disabled={!preferences.autoRefreshMetrics}
                  />
                  <p className="text-xs text-muted-foreground">Minimum 10 seconds</p>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Localization"
              description="Date, time and language preferences"
            >
              <SettingsGrid columns={3}>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(value) => updatePreference('timezone', value)}
                  >
                    <SelectTrigger className="bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                      <SelectItem value="America/Denver">America/Denver</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                      <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                      <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date format</Label>
                  <Select
                    value={preferences.dateFormat}
                    onValueChange={(value) => updatePreference('dateFormat', value as PlatformPreferences['dateFormat'])}
                  >
                    <SelectTrigger className="bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ISO">ISO (2024-01-15)</SelectItem>
                      <SelectItem value="US">US (01/15/2024)</SelectItem>
                      <SelectItem value="EU">EU (15/01/2024)</SelectItem>
                      <SelectItem value="relative">Relative (2h ago)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={preferences.language}
                    onValueChange={(value) => updatePreference('language', value as PlatformPreferences['language'])}
                  >
                    <SelectTrigger className="bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt-BR">Português (BR)</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingsGrid>
            </SettingsSection>

            <SettingsSection
              title="Session settings"
              description="Configure session timeout and warnings"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show session expiry warning</p>
                    <p className="text-xs text-muted-foreground">Display a warning before session expires</p>
                  </div>
                  <Switch
                    checked={preferences.showSessionWarning}
                    onCheckedChange={(checked) => updatePreference('showSessionWarning', checked)}
                  />
                </div>
                <div className="space-y-2 max-w-xs">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Session timeout (minutes)
                  </Label>
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    value={preferences.sessionTimeoutMinutes}
                    onChange={(e) => updatePreference('sessionTimeoutMinutes', Math.max(15, parseInt(e.target.value) || 60))}
                    className="bg-muted/40"
                  />
                  <p className="text-xs text-muted-foreground">Between 15 and 480 minutes (8 hours)</p>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Table preferences"
              description="Default settings for data tables"
            >
              <SettingsGrid columns={2}>
                <div className="space-y-2">
                  <Label>Default page size</Label>
                  <Select
                    value={String(preferences.defaultPageSize)}
                    onValueChange={(value) => updatePreference('defaultPageSize', parseInt(value) as PlatformPreferences['defaultPageSize'])}
                  >
                    <SelectTrigger className="bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 rows</SelectItem>
                      <SelectItem value="25">25 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Table density</Label>
                  <Select
                    value={preferences.showTableDensity}
                    onValueChange={(value) => updatePreference('showTableDensity', value as PlatformPreferences['showTableDensity'])}
                  >
                    <SelectTrigger className="bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingsGrid>
            </SettingsSection>

            <div className="flex justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={handleResetPreferences} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset to defaults
              </Button>
              <p className="text-xs text-muted-foreground self-center">
                Display preferences are saved automatically
              </p>
            </div>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-6">
            <div id="settings-scm-credential-form">
              <SettingsSection
                title="SCM credentials"
                description="Store Git provider tokens or SSH keys for build access. Service overrides project, project overrides platform."
              >
                <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Provider</th>
                        <th className="px-4 py-3 text-left font-medium">Scope</th>
                        <th className="px-4 py-3 text-left font-medium">Target</th>
                        <th className="px-4 py-3 text-left font-medium">Updated</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {scmCredentials.map((cred) => (
                        <tr key={credentialIdFromDocument(cred) || `${cred.name}-${cred.createdAt}`} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">{cred.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{cred.provider || 'github'}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {scopeLabel(cred.scope)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatCredentialTarget(cred.scope, cred.projectId, cred.serviceId)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {cred.updatedAt ? new Date(cred.updatedAt).toLocaleDateString() : new Date(cred.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteScmCredential(cred)}
                              aria-label={`Delete ${cred.name}`}
                              disabled={!credentialIdFromDocument(cred)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {scmCredentials.length === 0 && (
                        <TableEmptyRow
                          colSpan={6}
                          icon={<GitBranch className="h-5 w-5 text-muted-foreground" />}
                          title="No SCM credentials"
                          description="Add a Git token or SSH key to allow workers to clone repositories."
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={scmName}
                      onChange={(event) => setScmName(event.target.value)}
                      className="bg-muted/40"
                      placeholder="e.g. Platform GitHub Token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={scmProvider} onValueChange={setScmProvider}>
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {(providerCatalog?.scm.providers ?? []).map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Type</Label>
                    <Select value={scmAuthType} onValueChange={(value) => setScmAuthType(value as 'token' | 'ssh')}>
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="Select auth type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="token">Access Token</SelectItem>
                        <SelectItem value="ssh">SSH Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select value={scmScope} onValueChange={(value) => setScmScope(value as CredentialScope)}>
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">Platform (default)</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {scmScope === 'project' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Project</Label>
                      <Select value={scmProjectId} onValueChange={setScmProjectId}>
                        <SelectTrigger className="bg-muted/40">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {scmScope === 'service' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Service</Label>
                      <Select value={scmServiceId} onValueChange={setScmServiceId}>
                        <SelectTrigger className="bg-muted/40">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    {renderProviderMeta(
                      selectedScmProviderMeta,
                      selectedScmProviderStatus,
                      'Select an SCM provider to review supported authentication modes and capabilities.',
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{scmAuthType === 'token' ? 'Access Token' : 'SSH Private Key'}</Label>
                    <Input
                      type="password"
                      value={scmAuthType === 'token' ? scmToken : scmPrivateKey}
                      onChange={(event) =>
                        scmAuthType === 'token'
                          ? setScmToken(event.target.value)
                          : setScmPrivateKey(event.target.value)
                      }
                      className="bg-muted/40 font-mono text-sm"
                      placeholder={scmAuthType === 'token' ? 'ghp_...' : '-----BEGIN OPENSSH PRIVATE KEY-----'}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={scmNotes}
                      onChange={(event) => setScmNotes(event.target.value)}
                      className="bg-muted/40"
                      placeholder="Visibility, ownership, rotation"
                    />
                  </div>
                </div>
                  <div className="flex justify-end">
                    <Button onClick={handleCreateScmCredential} disabled={isSavingScm} className="gap-2">
                      <KeyRound className="h-4 w-4" />
                      {isSavingScm ? 'Saving...' : 'Add SCM credential'}
                    </Button>
                  </div>
                </div>
              </SettingsSection>
            </div>

            <div id="settings-registry-credential-form">
              <SettingsSection
                title="Registry credentials"
                description="Store container registry credentials for push and deploy operations."
              >
                <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Registry</th>
                        <th className="px-4 py-3 text-left font-medium">Scope</th>
                        <th className="px-4 py-3 text-left font-medium">Target</th>
                        <th className="px-4 py-3 text-left font-medium">Updated</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {registryCredentials.map((cred) => (
                        <tr key={credentialIdFromDocument(cred) || `${cred.name}-${cred.createdAt}`} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">{cred.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {cred.registryUrl || cred.provider || 'Registry'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {scopeLabel(cred.scope)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatCredentialTarget(cred.scope, cred.projectId, cred.serviceId)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {cred.updatedAt ? new Date(cred.updatedAt).toLocaleDateString() : new Date(cred.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteRegistryCredential(cred)}
                              aria-label={`Delete ${cred.name}`}
                              disabled={!credentialIdFromDocument(cred)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {registryCredentials.length === 0 && (
                        <TableEmptyRow
                          colSpan={6}
                          icon={<Package className="h-5 w-5 text-muted-foreground" />}
                          title="No registry credentials"
                          description="Add registry credentials to allow workers to push images."
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={registryName}
                      onChange={(event) => setRegistryName(event.target.value)}
                      className="bg-muted/40"
                      placeholder="e.g. Releasea Registry"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={registryProvider} onValueChange={setRegistryProvider}>
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {(providerCatalog?.registry.providers ?? []).map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Registry URL</Label>
                    <Input
                      value={registryUrl}
                      onChange={(event) => setRegistryUrl(event.target.value)}
                      className="bg-muted/40 font-mono text-sm"
                      placeholder="registry.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select value={registryScope} onValueChange={(value) => setRegistryScope(value as CredentialScope)}>
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">Platform (default)</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    {renderProviderMeta(
                      selectedRegistryProviderMeta,
                      selectedRegistryProviderStatus,
                      'Select a registry provider to review supported auth and delivery capabilities.',
                    )}
                  </div>
                  {registryScope === 'project' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Project</Label>
                      <Select value={registryProjectId} onValueChange={setRegistryProjectId}>
                        <SelectTrigger className="bg-muted/40">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {registryScope === 'service' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Service</Label>
                      <Select value={registryServiceId} onValueChange={setRegistryServiceId}>
                        <SelectTrigger className="bg-muted/40">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={registryUsername}
                      onChange={(event) => setRegistryUsername(event.target.value)}
                      className="bg-muted/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={registryPassword}
                      onChange={(event) => setRegistryPassword(event.target.value)}
                      className="bg-muted/40"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={registryNotes}
                      onChange={(event) => setRegistryNotes(event.target.value)}
                      className="bg-muted/40"
                      placeholder="Visibility, ownership, rotation"
                    />
                  </div>
                </div>
                  <div className="flex justify-end">
                    <Button onClick={handleCreateRegistryCredential} disabled={isSavingRegistry} className="gap-2">
                      <KeyRound className="h-4 w-4" />
                      {isSavingRegistry ? 'Saving...' : 'Add registry credential'}
                    </Button>
                  </div>
                </div>
              </SettingsSection>
            </div>

            <SettingsSection
              title="Secret providers"
              description="Connect a secrets manager and choose the default provider for services."
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {secretProviders.map((provider) => (
                        <tr key={provider.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{provider.name}</span>
                              {provider.notes && (
                                <span className="text-xs text-muted-foreground">{provider.notes}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{provider.type.toUpperCase()}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {provider.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => handleRemoveSecretProvider(provider.id)}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {secretProviders.length === 0 && (
                        <TableEmptyRow
                          colSpan={4}
                          icon={<ShieldCheck className="h-5 w-5 text-muted-foreground" />}
                          title="No secret providers"
                          description="Connect Vault, AWS, or GCP to resolve secret references during deploys."
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Default provider</Label>
                    <Select
                      value={defaultSecretProviderId || 'none'}
                      onValueChange={(value) =>
                        setDefaultSecretProviderId(value === 'none' ? '' : value)
                      }
                    >
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="No default provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No default provider</SelectItem>
                        {secretProviders.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name} · {provider.type.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={secretProviderName}
                      onChange={(event) => setSecretProviderName(event.target.value)}
                      className="bg-muted/40"
                      placeholder="e.g. Vault Prod"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={secretProviderType}
                      onValueChange={(value) => setSecretProviderType(value as SecretProviderType)}
                    >
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {(providerCatalog?.secrets.providers ?? []).map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    {renderProviderMeta(
                      selectedSecretProviderMeta,
                      selectedSecretProviderStatus,
                      'Select a secrets provider to review required configuration fields and capabilities.',
                    )}
                  </div>
                  {secretProviderType === 'vault' && (
                    <>
                      <div className="space-y-2">
                        <Label>Vault address</Label>
                        <Input
                          value={secretVaultAddress}
                          onChange={(event) => setSecretVaultAddress(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                          placeholder="https://vault.example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vault token</Label>
                        <Input
                          type="password"
                          value={secretVaultToken}
                          onChange={(event) => setSecretVaultToken(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                          placeholder="s.xxxxxx"
                        />
                      </div>
                    </>
                  )}
                  {secretProviderType === 'aws' && (
                    <>
                      <div className="space-y-2">
                        <Label>AWS access key</Label>
                        <Input
                          value={secretAwsAccessKey}
                          onChange={(event) => setSecretAwsAccessKey(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>AWS secret key</Label>
                        <Input
                          type="password"
                          value={secretAwsSecretKey}
                          onChange={(event) => setSecretAwsSecretKey(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>AWS region</Label>
                        <Input
                          value={secretAwsRegion}
                          onChange={(event) => setSecretAwsRegion(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                          placeholder="us-east-1"
                        />
                      </div>
                    </>
                  )}
                  {secretProviderType === 'gcp' && (
                    <>
                      <div className="space-y-2 md:col-span-2">
                        <Label>GCP project ID</Label>
                        <Input
                          value={secretGcpProjectId}
                          onChange={(event) => setSecretGcpProjectId(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Service account JSON</Label>
                        <Input
                          value={secretGcpServiceAccount}
                          onChange={(event) => setSecretGcpServiceAccount(event.target.value)}
                          className="bg-muted/40 font-mono text-sm"
                          placeholder='{"type":"service_account",...}'
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={secretProviderNotes}
                      onChange={(event) => setSecretProviderNotes(event.target.value)}
                      className="bg-muted/40"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAddSecretProvider} className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    Add secret provider
                  </Button>
                </div>
              </div>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <AIProvidersSettings />
          </TabsContent>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <SettingsSection
              title="Organization"
              description="Basic organization settings"
            >
              <SettingsGrid columns={2}>
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">Slug</Label>
                  <Input
                    id="org-slug"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    className="bg-muted/40 font-mono"
                  />
                </div>
              </SettingsGrid>
              <div className="space-y-2 mt-4">
                <Label htmlFor="api-url">Base API URL</Label>
                <Input
                  id="api-url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="bg-muted/40 font-mono"
                />
              </div>
            </SettingsSection>

            {providerCatalogSections.length > 0 && (
              <SettingsSection
                title="Provider catalog"
                description="Built-in provider families currently available in this Releasea installation."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {providerCatalogSections.map((category) => (
                    <div key={category.kind} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{category.label}</p>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {category.providers.map((provider) => {
                          const status = resolveCatalogProviderStatus(category.kind, provider.id);
                          return (
                            <div
                              key={`${category.kind}-${provider.id}`}
                              className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-[10px] space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{provider.label}</span>
                                {status ? (
                                  <Badge variant="outline" className={providerStateBadgeClass(status.state)}>
                                    {formatProviderState(status.state)}
                                  </Badge>
                                ) : null}
                              </div>
                              {status?.message ? (
                                <p className="text-[10px] text-muted-foreground">{status.message}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsSection>
            )}

            <SettingsSection
              title="Provider health checks"
              description="Run live validation against configured providers. This does not run automatically to avoid slowing down the settings page."
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Live provider validation</p>
                    <p className="text-xs text-muted-foreground">
                      Checks reachability and credential validity for configured SCM, registry, secrets and identity providers.
                    </p>
                  </div>
                  <Button onClick={() => void handleRunProviderHealthChecks()} disabled={isRunningProviderHealth} className="gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    {isRunningProviderHealth ? 'Running checks...' : 'Run health checks'}
                  </Button>
                </div>

                {providerHealthSections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Run the checks to inspect the current provider connectivity and configuration health.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {providerHealthSections.map((category) => {
                      const catalogCategory = providerCatalogSections.find((section) => section.kind === category.kind);
                      return (
                        <div key={`health-${category.kind}`} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">{catalogCategory?.label ?? category.kind}</p>
                              <p className="text-xs text-muted-foreground">{catalogCategory?.description}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                                {category.healthy} healthy
                              </Badge>
                              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                                {category.unhealthy} unhealthy
                              </Badge>
                              {typeof category.unsupported === 'number' && category.unsupported > 0 ? (
                                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                                  {category.unsupported} unsupported
                                </Badge>
                              ) : null}
                              {typeof category.disabled === 'number' && category.disabled > 0 ? (
                                <Badge variant="outline" className="border-border/60 bg-muted/30 text-muted-foreground">
                                  {category.disabled} disabled
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          {category.checks.length === 0 ? (
                            <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                              No configured resources to validate in this category.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {category.checks.map((check) => (
                                <div key={`${category.kind}-${check.providerId}-${check.resourceId ?? check.resourceLabel}`} className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {check.resourceLabel || check.providerLabel}
                                    </span>
                                    <Badge variant="outline" className={`text-[10px] ${providerHealthBadgeClass(check.state)}`}>
                                      {formatProviderHealthState(check.state)}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                      {check.providerLabel}
                                    </Badge>
                                    {check.scope ? (
                                      <Badge variant="outline" className="text-[10px]">
                                        {scopeLabel(check.scope as CredentialScope)}
                                      </Badge>
                                    ) : null}
                                    {check.default ? (
                                      <Badge variant="outline" className="text-[10px]">
                                        Default
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {check.message ? (
                                    <p className="text-xs text-muted-foreground">{check.message}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SettingsSection>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <SettingsSection
              title="Deployment notifications"
              description="Receive alerts about deployment events"
            >
              <div className="space-y-4">
                {[
                  { id: 'deploySuccess', label: 'Deploy completed successfully', description: 'Notify when a deploy finishes' },
                  { id: 'deployFailed', label: 'Deploy failed', description: 'Notify when a deploy fails' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={notifications[item.id as keyof typeof notifications]}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, [item.id]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Infrastructure alerts"
              description="Receive alerts about infrastructure health"
            >
              <div className="space-y-4">
                {[
                  { id: 'serviceDown', label: 'Service offline', description: 'Alert when a service becomes unavailable' },
                  { id: 'workerOffline', label: 'Worker offline', description: 'Alert when a worker loses connection' },
                  { id: 'highCpu', label: 'High CPU usage', description: 'Alert when CPU exceeds 80%' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={notifications[item.id as keyof typeof notifications]}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, [item.id]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Approval notifications"
              description="Receive notifications about approval workflows"
            >
              <div className="space-y-4">
                {[
                  { id: 'approvalRequired', label: 'Approval required', description: 'Notify when a deploy or rule requires approval' },
                  { id: 'approvalCompleted', label: 'Approval completed', description: 'Notify when your request is approved or rejected' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={notifications[item.id as keyof typeof notifications]}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, [item.id]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </SettingsSection>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <SettingsSection
              title="Service templates"
              description="Manage the catalog of templates available in the New Service flow."
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Template</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Source</th>
                        <th className="px-4 py-3 text-left font-medium">Mode</th>
                        <th className="px-4 py-3 text-left font-medium">Verification</th>
                        <th className="px-4 py-3 text-left font-medium">Updated</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {serviceTemplates.map((template) => (
                        <tr key={template.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{template.label}</p>
                              <p className="text-xs text-muted-foreground">{template.id}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {formatTemplateType(template)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatTemplateSource(template)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatTemplateMode(template)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <Badge
                                variant="outline"
                                className={
                                  template.verification?.status === 'verified'
                                    ? 'border-success/30 bg-success/10 text-success'
                                    : template.verification?.status === 'invalid'
                                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                      : 'border-warning/30 bg-warning/10 text-warning'
                                }
                              >
                                {formatTemplateVerificationStatus(template)}
                              </Badge>
                              {template.verification?.issues?.length ? (
                                <p className="text-xs text-muted-foreground">
                                  {template.verification.issues.length} issue{template.verification.issues.length === 1 ? '' : 's'}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">No issues</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {template.updatedAt
                              ? new Date(template.updatedAt).toLocaleDateString()
                              : template.createdAt
                                ? new Date(template.createdAt).toLocaleDateString()
                                : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {serviceTemplates.length === 0 && (
                        <TableEmptyRow
                          colSpan={7}
                          icon={<LayoutTemplate className="h-5 w-5 text-muted-foreground" />}
                          title="No templates yet"
                          description="Import a template definition to populate the service catalog."
                          actionLabel="Load starter template"
                          onAction={() => setTemplateImportPayload(STARTER_TEMPLATE_IMPORT)}
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Import templates (YAML or JSON)</Label>
                    <p className="text-xs text-muted-foreground">
                      Paste a single template or an array of templates to add them to the catalog.
                    </p>
                  </div>
                  <Textarea
                    rows={8}
                    value={templateImportPayload}
                    onChange={(event) => {
                      setTemplateImportPayload(event.target.value);
                      setTemplateVerificationPreview([]);
                    }}
                    placeholder="id: microservice-node\nlabel: Node.js Microservice\n..."
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Templates with matching IDs will be updated.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyTemplates}
                        disabled={isVerifyingTemplates || isImportingTemplates}
                      >
                        {isVerifyingTemplates ? 'Verifying...' : 'Verify templates'}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleImportTemplates}
                        disabled={isImportingTemplates}
                      >
                        {isImportingTemplates ? 'Importing...' : 'Import templates'}
                      </Button>
                    </div>
                  </div>
                  {templateVerificationPreview.length > 0 && (
                    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Verification preview</p>
                        <p className="text-xs text-muted-foreground">
                          Review template issues before importing them into the catalog.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {templateVerificationPreview.map((template) => (
                          <div key={`${template.id || template.label || 'template'}-preview`} className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-foreground">{template.label || template.id || 'Untitled template'}</p>
                                <p className="text-xs text-muted-foreground">{template.id || 'No template id yet'}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={
                                  template.verification?.status === 'verified'
                                    ? 'border-success/30 bg-success/10 text-success'
                                    : template.verification?.status === 'invalid'
                                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                      : 'border-warning/30 bg-warning/10 text-warning'
                                }
                              >
                                {formatTemplateVerificationStatus(template)}
                              </Badge>
                            </div>
                            {template.verification?.summary ? (
                              <p className="text-xs text-muted-foreground">{template.verification.summary}</p>
                            ) : null}
                            {(template.verification?.issues ?? []).length > 0 && (
                              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {template.verification?.issues.map((issue) => (
                                  <li key={`${template.id}-${issue.code}-${issue.message}`}>{issue.message}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SettingsSection>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-6">
            <SettingsSection
              title="Service limits"
              description="Configure resource limits for services"
            >
              <SettingsGrid columns={3}>
                <div className="space-y-2">
                  <Label>Max services per project</Label>
                  <Input
                    type="number"
                    value={resourceLimits.maxServicesPerProject}
                    onChange={(e) =>
                      setResourceLimits(prev => ({ ...prev, maxServicesPerProject: parseInt(e.target.value) || 50 }))
                    }
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max replicas per service</Label>
                  <Input
                    type="number"
                    value={resourceLimits.maxReplicasPerService}
                    onChange={(e) =>
                      setResourceLimits(prev => ({ ...prev, maxReplicasPerService: parseInt(e.target.value) || 10 }))
                    }
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max CPU cores per replica</Label>
                  <Input
                    type="number"
                    value={resourceLimits.maxCpuPerReplica}
                    onChange={(e) =>
                      setResourceLimits(prev => ({ ...prev, maxCpuPerReplica: parseInt(e.target.value) || 4 }))
                    }
                    className="bg-muted/40"
                  />
                </div>
              </SettingsGrid>
              <div className="space-y-2 mt-4">
                <Label>Max memory per replica (MB)</Label>
                <Input
                  type="number"
                  value={resourceLimits.maxMemoryPerReplica}
                  onChange={(e) =>
                    setResourceLimits(prev => ({ ...prev, maxMemoryPerReplica: parseInt(e.target.value) || 8192 }))
                  }
                  className="bg-muted/40 max-w-xs"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Default values"
              description="Default resource allocation for new services"
            >
              <SettingsGrid columns={3}>
                <div className="space-y-2">
                  <Label>Default replicas</Label>
                  <Input
                    type="number"
                    value={resourceLimits.defaultReplicas}
                    onChange={(e) =>
                      setResourceLimits(prev => ({ ...prev, defaultReplicas: parseInt(e.target.value) || 2 }))
                    }
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default CPU cores</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={resourceLimits.defaultCpu}
                    onChange={(e) =>
                      setResourceLimits(prev => ({ ...prev, defaultCpu: parseFloat(e.target.value) || 0.5 }))
                    }
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default memory (MB)</Label>
                  <Input
                    type="number"
                    value={resourceLimits.defaultMemory}
                    onChange={(e) =>
                      setResourceLimits(prev => ({ ...prev, defaultMemory: parseInt(e.target.value) || 512 }))
                    }
                    className="bg-muted/40"
                  />
                </div>
              </SettingsGrid>
            </SettingsSection>
          </TabsContent>

        </Tabs>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save all changes'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
