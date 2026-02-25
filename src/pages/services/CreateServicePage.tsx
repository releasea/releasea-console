import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBackLink } from '@/components/layout/PageBackLink';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ServiceType, DeployStrategyType, RegistryCredential, ScmCredential } from '@/types/releasea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  checkGithubTemplateRepoAvailability,
  createGithubTemplateRepo,
  createService,
  performAction,
  updateService,
  fetchPlatformSettings,
  fetchProjects,
  fetchRegistryCredentials,
  fetchScmCredentials,
  fetchServiceTemplates,
  fetchRuntimeProfiles,
} from '@/lib/data';
import type { Project, SecretProvider, ServiceTemplate as ServiceTemplatePayload } from '@/types/releasea';
import type { CatalogTemplate, EnvVar, RepoMode, SourceType } from './create-service/catalog';
import { frameworks, mapCatalogTemplates } from './create-service/catalog';
import {
  normalizeRepoName,
  normalizeRegistryHost,
  normalizeSecretValue,
  parseRepositoryReference,
  resolveGitBaseUrl,
  resolveImageBase,
} from './create-service/helpers';
import { ServiceTemplateCatalogStep } from './create-service/ServiceTemplateCatalogStep';
import { EnvironmentVariablesSection } from '@/forms/components/EnvironmentVariablesSection';
import { CreateServiceFormStoreProvider } from '@/forms/store/create-service-form-store';
import { RepositorySourceSection } from './create-service/RepositorySourceSection';
import { RuntimeProfile } from '@/types/runtime-profile';

const TEMPLATE_OWNER = import.meta.env.RELEASEA_TEMPLATE_OWNER || 'releasea';
const TEMPLATE_REPO = import.meta.env.RELEASEA_TEMPLATE_REPO || 'templates';

export default function CreateService() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const originProjectId = searchParams.get('project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<RuntimeProfile[]>([]);
  const originProject = originProjectId
    ? projects.find((project) => project.id === originProjectId)
    : null;
  const backLink = originProjectId ? `/projects/${originProjectId}` : '/services';
  const backLabel = originProject?.name ?? (originProjectId ? 'Project' : 'Services');

  const [step, setStep] = useState<'type' | 'config'>('type');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplatePayload[]>([]);

  const [serviceName, setServiceName] = useState('my-service');
  const [projectId, setProjectId] = useState('');
  const [profileId, setProfileId] = useState('');

  const [sourceType, setSourceType] = useState<SourceType>('git');
  const [repoMode, setRepoMode] = useState<RepoMode>('template');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [rootDir, setRootDir] = useState('.');
  const [dockerImage, setDockerImage] = useState('');
  const [dockerContext, setDockerContext] = useState('.');
  const [dockerfilePath, setDockerfilePath] = useState('./Dockerfile');

  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  const [port, setPort] = useState('3000');
  const [healthCheckPath, setHealthCheckPath] = useState('/healthz');
  const [pauseOnIdle] = useState(false);
  const [pauseIdleTimeoutMinutes] = useState('60');
  const [minReplicas, setMinReplicas] = useState('1');
  const [maxReplicas, setMaxReplicas] = useState('3');
  const [scmCredentialId, setScmCredentialId] = useState('inherit');
  const [registryCredentialId, setRegistryCredentialId] = useState('inherit');
  const [secretProviderId, setSecretProviderId] = useState('inherit');
  const [dockerCommand, setDockerCommand] = useState('');
  const [preDeployCommand, setPreDeployCommand] = useState('');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [deployStrategyType, setDeployStrategyType] = useState<DeployStrategyType>('rolling');
  const [canaryPercent, setCanaryPercent] = useState('10');
  const [blueGreenPrimary, setBlueGreenPrimary] = useState<'blue' | 'green'>('blue');

  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [installCommand, setInstallCommand] = useState('npm install');
  const [outputDir, setOutputDir] = useState('dist');
  const [framework, setFramework] = useState('vite');
  const [cacheTtl, setCacheTtl] = useState('3600');

  const [scheduleCron, setScheduleCron] = useState('0 2 * * *');
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC');
  const [scheduleCommand, setScheduleCommand] = useState('');
  const [scheduleRetries, setScheduleRetries] = useState('3');
  const [scheduleTimeout, setScheduleTimeout] = useState('900');

  const [envVars, setEnvVars] = useState<EnvVar[]>([
    { id: 'env-1', key: '', value: '', type: 'plain' },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [templateRepoAvailability, setTemplateRepoAvailability] = useState<
    'idle' | 'checking' | 'available' | 'exists' | 'error'
  >('idle');
  const [templateRepoAvailabilityMessage, setTemplateRepoAvailabilityMessage] = useState('');
  const templateRepoCheckRequestRef = useRef(0);
  const [scmCredentials, setScmCredentials] = useState<ScmCredential[]>([]);
  const [registryCredentials, setRegistryCredentials] = useState<RegistryCredential[]>([]);
  const [secretProviders, setSecretProviders] = useState<SecretProvider[]>([]);
  const [defaultSecretProviderId, setDefaultSecretProviderId] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [projectsData, scmData, registryData, settingsData, templatesData, profileData] = await Promise.all([
        fetchProjects(),
        fetchScmCredentials(),
        fetchRegistryCredentials(),
        fetchPlatformSettings(),
        fetchServiceTemplates(),
        fetchRuntimeProfiles(),
      ]);
      if (!active) return;
      setProjects(projectsData);
      setScmCredentials(scmData);
      setRegistryCredentials(registryData);
      setServiceTemplates(templatesData);
      setSecretProviders(settingsData.secrets?.providers ?? []);
      setDefaultSecretProviderId(settingsData.secrets?.defaultProviderId ?? '');
      setProfiles(profileData);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const projectParam = searchParams.get('project');
    if (projectParam) {
      setProjectId(projectParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const profileParam = searchParams.get('profile');
    if (profileParam) {
      setProfileId(profileParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (profileId) return; // respeita valor vindo da URL ou seleção do usuário
    if (!profiles || profiles.length === 0) return;
    setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  useEffect(() => {
    if (repoMode === 'template' && sourceType !== 'git') {
      setSourceType('git');
    }
  }, [repoMode, sourceType]);

  const serviceOptions = useMemo<CatalogTemplate[]>(
    () => mapCatalogTemplates(serviceTemplates),
    [serviceTemplates]
  );

  const selectedTemplate = useMemo(
    () => serviceOptions.find((option) => option.id === selectedTemplateId) ?? null,
    [selectedTemplateId, serviceOptions]
  );
  const selectedType = selectedTemplate?.type ?? null;
  const selectedTemplateKind = selectedTemplate?.templateKind ?? 'service';
  const scopedScmCredentials = useMemo(
    () =>
      scmCredentials.filter(
        (cred) => cred.scope === 'platform' || (cred.scope === 'project' && cred.projectId === projectId)
      ),
    [scmCredentials, projectId]
  );
  const scopedRegistryCredentials = useMemo(
    () =>
      registryCredentials.filter(
        (cred) => cred.scope === 'platform' || (cred.scope === 'project' && cred.projectId === projectId)
      ),
    [registryCredentials, projectId]
  );
  const filteredServiceOptions = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLowerCase();
    return serviceOptions.filter((option) => {
      const haystack = [
        option.id,
        option.label,
        option.description,
        option.category,
        option.owner,
        option.bestFor,
        option.defaults,
        option.setupTime,
        option.tier,
        ...option.highlights,
      ]
        .join(' ')
        .toLowerCase();
      if (!normalizedQuery) return true;
      return haystack.includes(normalizedQuery);
    });
  }, [catalogQuery, serviceOptions]);
  const selectedLabel = selectedTemplate?.label ?? 'Service';
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId) ?? null,
    [profiles, profileId]
  );
  const selectedTemplateSource = selectedTemplate?.templateSource;
  const selectedTemplatePath =
    selectedTemplateSource?.path ?? selectedTemplate?.templatePath ?? '';
  const templateSourceOwner = selectedTemplateSource?.owner || TEMPLATE_OWNER;
  const templateSourceRepo = selectedTemplateSource?.repo || TEMPLATE_REPO;

  const selectedProjectForForm = useMemo(() => {
    const targetProjectId = projectId || originProjectId || '';
    if (!targetProjectId) return null;
    return projects.find((project) => project.id === targetProjectId) ?? null;
  }, [projects, projectId, originProjectId]);

  const templateRepoNameSuggestion = useMemo(() => normalizeRepoName(serviceName), [serviceName]);
  const isTemplateMode: boolean = repoMode === 'template';
  const isTemplateRepoChecking = isTemplateMode && templateRepoAvailability === 'checking';
  const isTemplateRepoAlreadyExists = isTemplateMode && templateRepoAvailability === 'exists';
  const isSubmitDisabled = isLoading || isTemplateRepoChecking || isTemplateRepoAlreadyExists;

  const pickLatestCredential = <T extends { createdAt?: string; updatedAt?: string }>(items: T[]) => {
    if (items.length === 0) return null;
    return [...items].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    })[0];
  };

  const platformScmCredential = useMemo(() => {
    const candidates = scmCredentials.filter((cred) => cred.scope === 'platform');
    return pickLatestCredential(candidates);
  }, [scmCredentials]);

  const platformRegistryCredential = useMemo(() => {
    const candidates = registryCredentials.filter((cred) => cred.scope === 'platform');
    return pickLatestCredential(candidates);
  }, [registryCredentials]);

  const selectedScmCredential = useMemo(
    () =>
      scmCredentialId === 'inherit'
        ? null
        : scopedScmCredentials.find((cred) => cred.id === scmCredentialId) ?? null,
    [scmCredentialId, scopedScmCredentials],
  );
  const selectedRegistryCredential = useMemo(
    () =>
      registryCredentialId === 'inherit'
        ? null
        : scopedRegistryCredentials.find((cred) => cred.id === registryCredentialId) ?? null,
    [registryCredentialId, scopedRegistryCredentials],
  );
  const inheritedScmCredential = useMemo(
    () =>
      scopedScmCredentials.find((cred) => cred.id === selectedProjectForForm?.scmCredentialId) ?? null,
    [scopedScmCredentials, selectedProjectForForm?.scmCredentialId],
  );
  const inheritedRegistryCredential = useMemo(
    () =>
      scopedRegistryCredentials.find((cred) => cred.id === selectedProjectForForm?.registryCredentialId) ?? null,
    [scopedRegistryCredentials, selectedProjectForForm?.registryCredentialId],
  );
  const effectiveScmCredential = selectedScmCredential ?? inheritedScmCredential ?? platformScmCredential;
  const effectiveRegistryCredential =
    selectedRegistryCredential ?? inheritedRegistryCredential ?? platformRegistryCredential;

  const projectRepoRef = useMemo(
    () => parseRepositoryReference(selectedProjectForForm?.repositoryUrl ?? ''),
    [selectedProjectForForm?.repositoryUrl],
  );
  const defaultTemplateRepoOwner =
    selectedProjectForForm?.owner?.trim() || projectRepoRef?.owner || TEMPLATE_OWNER;

  const gitBaseUrl = resolveGitBaseUrl(effectiveScmCredential?.provider);
  const templateRepoUrl = templateRepoNameSuggestion
    ? `${gitBaseUrl}/${defaultTemplateRepoOwner}/${templateRepoNameSuggestion}`
    : '';
  const effectiveTemplateRepoUrl = (repoUrl.trim() || templateRepoUrl).trim();
  const parsedTemplateRepo = useMemo(
    () => parseRepositoryReference(effectiveTemplateRepoUrl),
    [effectiveTemplateRepoUrl],
  );
  const templateRepoOwner = parsedTemplateRepo?.owner ?? defaultTemplateRepoOwner;
  const templateRepoName = parsedTemplateRepo?.name ?? templateRepoNameSuggestion;

  useEffect(() => {
    if (!(repoMode === 'template' && sourceType === 'git')) {
      templateRepoCheckRequestRef.current += 1;
      setTemplateRepoAvailability('idle');
      setTemplateRepoAvailabilityMessage('');
      return;
    }

    if (repoUrl.trim() && !parsedTemplateRepo) {
      templateRepoCheckRequestRef.current += 1;
      setTemplateRepoAvailability('error');
      setTemplateRepoAvailabilityMessage('Use a valid repository URL like https://github.com/org/repo.');
      return;
    }

    const owner = parsedTemplateRepo?.owner?.trim() ?? '';
    const name = parsedTemplateRepo?.name?.trim() ?? '';
    if (!owner || !name) {
      templateRepoCheckRequestRef.current += 1;
      setTemplateRepoAvailability('idle');
      setTemplateRepoAvailabilityMessage('');
      return;
    }

    const provider = effectiveScmCredential?.provider?.toLowerCase() ?? '';
    if (!effectiveScmCredential?.id || provider !== 'github') {
      templateRepoCheckRequestRef.current += 1;
      setTemplateRepoAvailability('idle');
      setTemplateRepoAvailabilityMessage('');
      return;
    }

    const requestId = templateRepoCheckRequestRef.current + 1;
    templateRepoCheckRequestRef.current = requestId;
    setTemplateRepoAvailability('checking');
    setTemplateRepoAvailabilityMessage('');

    const timer = window.setTimeout(async () => {
      const { exists, error } = await checkGithubTemplateRepoAvailability({
        owner,
        name,
        projectId: projectId || originProjectId || undefined,
        scmCredentialId: effectiveScmCredential.id,
      });

      if (templateRepoCheckRequestRef.current !== requestId) return;

      if (error) {
        setTemplateRepoAvailability('error');
        setTemplateRepoAvailabilityMessage(error);
        return;
      }

      if (exists) {
        setTemplateRepoAvailability('exists');
        setTemplateRepoAvailabilityMessage(
          `Repository ${owner}/${name} already exists on GitHub. Choose another service name.`,
        );
        return;
      }

      setTemplateRepoAvailability('available');
      setTemplateRepoAvailabilityMessage('');
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    repoMode,
    sourceType,
    repoUrl,
    parsedTemplateRepo,
    effectiveScmCredential?.id,
    effectiveScmCredential?.provider,
    projectId,
    originProjectId,
  ]);

  const registryHost =
    normalizeRegistryHost(effectiveRegistryCredential?.registryUrl) || 'docker.io';
  const templateImageOwner = templateRepoOwner.toLowerCase();
  const templateImageBase = templateRepoName
    ? `${registryHost}/${templateImageOwner}/${templateRepoName}`
    : '';
  const dockerImageValue = dockerImage.trim();
  const templateImageLatest = templateImageBase ? `${templateImageBase}:latest` : '';
  const templateImageValue = dockerImageValue || templateImageLatest;
  const templateImageBaseValue = templateImageValue ? resolveImageBase(templateImageValue) : '';
  const templateImageHash = templateImageBaseValue ? `${templateImageBaseValue}:<git-sha>` : '';

  const applyTemplateDefaults = (template: CatalogTemplate) => {
    const defaults = template.templateDefaults;
    if (!defaults) {
      if (template.type === 'microservice') {
        setHealthCheckPath('/healthz');
      }
      return '';
    }
    const resolvedServiceName = defaults.serviceName ?? serviceName;
    if (defaults.serviceName) setServiceName(defaults.serviceName);
    if (defaults.sourceType) setSourceType(defaults.sourceType);
    if (defaults.repoUrl !== undefined) setRepoUrl(defaults.repoUrl);
    if (defaults.branch !== undefined) setBranch(defaults.branch);
    if (defaults.rootDir !== undefined) setRootDir(defaults.rootDir);
    if (defaults.dockerImage !== undefined) setDockerImage(defaults.dockerImage);
    if (defaults.dockerContext !== undefined) setDockerContext(defaults.dockerContext);
    if (defaults.dockerfilePath !== undefined) setDockerfilePath(defaults.dockerfilePath);
    if (defaults.port !== undefined) setPort(defaults.port);
    if (template.type === 'microservice') {
      setHealthCheckPath(defaults.healthCheckPath ?? '/healthz');
    }
    if (defaults.framework !== undefined) setFramework(defaults.framework);
    if (defaults.buildCommand !== undefined) setBuildCommand(defaults.buildCommand);
    if (defaults.installCommand !== undefined) setInstallCommand(defaults.installCommand);
    if (defaults.outputDir !== undefined) setOutputDir(defaults.outputDir);
    if (defaults.cacheTtl !== undefined) setCacheTtl(defaults.cacheTtl);
    if (defaults.dockerCommand !== undefined) setDockerCommand(defaults.dockerCommand);
    if (defaults.preDeployCommand !== undefined) setPreDeployCommand(defaults.preDeployCommand);
    if (defaults.scheduleCron !== undefined) setScheduleCron(defaults.scheduleCron);
    if (defaults.scheduleTimezone !== undefined) setScheduleTimezone(defaults.scheduleTimezone);
    if (defaults.scheduleCommand !== undefined) setScheduleCommand(defaults.scheduleCommand);
    if (defaults.scheduleRetries !== undefined) setScheduleRetries(defaults.scheduleRetries);
    if (defaults.scheduleTimeout !== undefined) setScheduleTimeout(defaults.scheduleTimeout);
    return resolvedServiceName;
  };

  const templateHealthCheckPath = (template: CatalogTemplate | null): string => {
    if (!template) return '';
    const typed = template.templateDefaults?.healthCheckPath?.trim();
    if (typed) return typed;
    const rawTemplate = template as unknown as Record<string, unknown>;
    const rawDefaults = rawTemplate.template_defaults as Record<string, unknown> | undefined;
    const snake = typeof rawDefaults?.health_check_path === 'string' ? rawDefaults.health_check_path.trim() : '';
    return snake;
  };

  const addEnvVar = () => {
    const nextId = `env-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setEnvVars((vars) => [...vars, { id: nextId, key: '', value: '', type: 'plain' }]);
  };

  const updateEnvVar = (id: string, field: keyof EnvVar, value: string) => {
    setEnvVars((vars) => vars.map((variable) => (variable.id === id ? { ...variable, [field]: value } : variable)));
  };

  const removeEnvVar = (id: string) => {
    setEnvVars((vars) => vars.filter((variable) => variable.id !== id));
  };

  const buildEnvironmentPayload = () =>
    envVars.reduce<Record<string, string>>((acc, variable) => {
      const key = variable.key.trim();
      if (!key) return acc;
      const rawValue = String(variable.value ?? '');
      const value =
        variable.type === 'secret' ? normalizeSecretValue(rawValue) : rawValue.trim();
      acc[key] = value;
      return acc;
    }, {});

  const handleRepoModeChange = (mode: RepoMode) => {
    setRepoMode(mode);
    setRepoUrl('');
    if (mode === 'template') {
      setSourceType('git');
      setRootDir('.');
      return;
    }
    setRootDir('.');
  };

  const createServiceFormStore = {
    sourceType,
    setSourceType,
    repoMode,
    handleRepoModeChange,
    repoUrl,
    setRepoUrl,
    branch,
    setBranch,
    rootDir,
    setRootDir,
    dockerImage,
    setDockerImage,
    isTemplateMode,
    templateRepoUrl,
    templateRepoAvailability,
    templateRepoAvailabilityMessage,
    envVars,
    addEnvVar,
    updateEnvVar,
    removeEnvVar,
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedType) return;
    if (isTemplateRepoChecking) {
      toast({
        title: 'Checking repository',
        description: 'Wait for the GitHub repository validation to finish.',
      });
      return;
    }
    if (isTemplateRepoAlreadyExists) {
      toast({
        title: 'Repository already exists',
        description: templateRepoAvailabilityMessage || 'Choose another service name to create a new repository.',
        variant: 'destructive',
      });
      return;
    }
    if (!isTemplateMode && sourceType === 'git' && repoUrl.trim() === '') {
      toast({
        title: 'Repository required',
        description: 'Provide a repository URL.',
      });
      return;
    }
    if (!isTemplateMode && sourceType === 'docker' && dockerImage.trim() === '') {
      toast({
        title: 'Docker image required',
        description: 'Provide a Docker image reference.',
      });
      return;
    }
    setIsLoading(true);

    const parsedPort = Number(port);
    const portValue = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : undefined;
    const parsedCanaryPercent = Number(canaryPercent);
    const canaryPercentValue =
      Number.isFinite(parsedCanaryPercent) && parsedCanaryPercent >= 0
        ? parsedCanaryPercent
        : undefined;
    const parsedPauseIdleMinutes = Number(pauseIdleTimeoutMinutes);
    const pauseIdleTimeoutSeconds =
      Number.isFinite(parsedPauseIdleMinutes) && parsedPauseIdleMinutes > 0
        ? Math.max(60, Math.round(parsedPauseIdleMinutes * 60))
        : 3600;
    const resolvedProjectId = projectId || originProjectId || undefined;
    const platformScmId = platformScmCredential?.id ?? '';
    const platformRegistryId = platformRegistryCredential?.id ?? '';
    const inheritedScmCredentialId = selectedProjectForForm?.scmCredentialId ?? '';
    const inheritedRegistryCredentialId = selectedProjectForForm?.registryCredentialId ?? '';
    const chosenScmCredentialId = scmCredentialId === 'inherit' ? inheritedScmCredentialId : scmCredentialId;
    const chosenRegistryCredentialId =
      registryCredentialId === 'inherit' ? inheritedRegistryCredentialId : registryCredentialId;
    const resolvedScmCredentialId = isTemplateMode
      ? (chosenScmCredentialId || platformScmId)
      : (scmCredentialId === 'inherit' ? '' : scmCredentialId);
    const resolvedRegistryCredentialId = isTemplateMode
      ? (chosenRegistryCredentialId || platformRegistryId)
      : (registryCredentialId === 'inherit' ? '' : registryCredentialId);
    const resolvedSecretProviderId =
      secretProviderId === 'inherit' ? '' : secretProviderId;

    const resolvedSourceType = isTemplateMode ? 'git' : (sourceType === 'docker' ? 'registry' : 'git');
    const isScheduledJob = selectedTemplateKind === 'scheduled-job';
    const deployTemplateId = isScheduledJob
      ? 'tpl-cronjob'
      : (resolvedSourceType === 'registry' ? 'tpl-registry' : 'tpl-git');
    const resolvedHealthCheckPath =
      selectedType === 'microservice'
        ? (
          healthCheckPath.trim() ||
          templateHealthCheckPath(selectedTemplate) ||
          '/healthz'
        )
        : undefined;

    const resolvedDockerImage =
      selectedType === 'microservice'
        ? (isTemplateMode ? templateImageValue : dockerImageValue)
        : '';
    if (selectedType === 'microservice' && resolvedSourceType === 'git' && !resolvedDockerImage) {
      toast({
        title: 'Registry configuration required',
        description: 'Configure a platform registry credential before creating this service.',
      });
      setIsLoading(false);
      return;
    }
    if (isTemplateMode) {
      if (!parsedTemplateRepo) {
        toast({
          title: 'Invalid repository URL',
          description: 'Use a valid URL like https://github.com/org/repo.',
        });
        setIsLoading(false);
        return;
      }
      if (!templateRepoName) {
        toast({
          title: 'Service name required',
          description: 'Provide a service name to create the repository.',
        });
        setIsLoading(false);
        return;
      }
      if (!effectiveScmCredential || effectiveScmCredential.provider?.toLowerCase() !== 'github') {
        toast({
          title: 'Git provider not supported',
          description: 'Template creation currently supports GitHub credentials only.',
        });
        setIsLoading(false);
        return;
      }
      if (selectedType === 'microservice' && !effectiveRegistryCredential) {
        toast({
          title: 'Registry not configured',
          description: 'Configure a registry credential before creating this service.',
        });
        setIsLoading(false);
        return;
      }

      const createdService = await createService({
        name: serviceName,
        type: selectedType,
        projectId: resolvedProjectId,
        port: portValue,
        sourceType: resolvedSourceType,
        status: 'creating',
        repoUrl: '',
        branch: '',
        rootDir: '.',
        dockerImage: resolvedDockerImage,
        healthCheckPath: resolvedHealthCheckPath,
        dockerContext,
        dockerfilePath,
        dockerCommand,
        preDeployCommand,
        repoManaged: true,
        ...(isScheduledJob
          ? {
            scheduleCron,
            scheduleTimezone,
            scheduleCommand,
            scheduleRetries,
            scheduleTimeout,
          }
          : {}),
        framework: selectedType === 'static-site' ? framework : undefined,
        installCommand: selectedType === 'static-site' ? installCommand : undefined,
        buildCommand: selectedType === 'static-site' ? buildCommand : undefined,
        outputDir: selectedType === 'static-site' ? outputDir : undefined,
        cacheTtl: selectedType === 'static-site' ? cacheTtl : undefined,
        environment: buildEnvironmentPayload(),
        scmCredentialId: resolvedScmCredentialId || undefined,
        registryCredentialId: resolvedRegistryCredentialId || undefined,
        secretProviderId: resolvedSecretProviderId || undefined,
        deployTemplateId,
        deploymentStrategy: {
          type: deployStrategyType,
          canaryPercent: canaryPercentValue,
          blueGreenPrimary,
        },
        minReplicas: Number(minReplicas),
        maxReplicas: Number(maxReplicas),
        profileId: profileId || undefined,
        autoDeploy,
        pauseOnIdle: selectedType === 'microservice' ? pauseOnIdle : false,
        pauseIdleTimeoutSeconds: selectedType === 'microservice' ? pauseIdleTimeoutSeconds : undefined,
      });

      setIsLoading(false);

      toast({
        title: 'Service is being created',
        description: `Service "${serviceName}" is provisioning its repository.`,
      });

      navigate(`/services/${createdService.id}`);

      void (async () => {
        const { repo, error } = await createGithubTemplateRepo({
          scmCredentialId: resolvedScmCredentialId || undefined,
          projectId: resolvedProjectId || undefined,
          templateOwner: templateSourceOwner,
          templateRepo: templateSourceRepo,
          templatePath: selectedTemplatePath || undefined,
          owner: parsedTemplateRepo.owner,
          name: parsedTemplateRepo.name,
          private: newRepoPrivate,
        });
        if (error || !repo) {
          await updateService(createdService.id, { status: 'error' });
          toast({
            title: 'Failed to create repository',
            description: error || 'Check your GitHub credentials and try again.',
            variant: 'destructive',
          });
          return;
        }

        const resolvedRepoUrl = repo.clone_url || repo.html_url || effectiveTemplateRepoUrl;
        const resolvedBranch = repo.default_branch || branch;
        const baseSetupPayload = {
          repoUrl: resolvedRepoUrl,
          branch: resolvedBranch,
          rootDir: '.',
          repoManaged: true,
        };

        const shouldTriggerFirstAutoDeploy = autoDeploy && selectedType === 'microservice';
        if (!shouldTriggerFirstAutoDeploy) {
          await updateService(createdService.id, {
            ...baseSetupPayload,
            status: 'created',
          });
          return;
        }

        // The deploy endpoint blocks while service.status is "creating".
        // Mark service as created before queueing the first auto deploy.
        await updateService(createdService.id, {
          ...baseSetupPayload,
          status: 'created',
        });
        const deployQueued = await performAction({
          endpoint: `/services/${createdService.id}/deploys`,
          method: 'POST',
          payload: {
            environment: 'prod',
            version: 'head',
            trigger: 'auto',
          },
          label: 'createService.firstAutoDeploy',
        });
        if (!deployQueued) {
          await updateService(createdService.id, { status: 'created' });
          toast({
            title: 'Auto-deploy unavailable',
            description: 'Repository created, but the first deploy could not be queued automatically.',
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'First deploy queued',
          description: `Auto-deploy is enabled. ${serviceName} entered deploy flow automatically.`,
        });
      })();

      return;
    }

    const resolvedRepoUrl = repoUrl;
    const resolvedBranch = branch;

    const createdService = await createService({
      name: serviceName,
      type: selectedType,
      projectId: resolvedProjectId,
      port: portValue,
      sourceType: resolvedSourceType,
      repoUrl: resolvedSourceType === 'git' ? resolvedRepoUrl : '',
      branch: resolvedSourceType === 'git' ? resolvedBranch : '',
      rootDir: resolvedSourceType === 'git' ? rootDir : '',
      dockerImage: resolvedDockerImage,
      healthCheckPath: resolvedHealthCheckPath,
      dockerContext,
      dockerfilePath,
      dockerCommand,
      preDeployCommand,
      ...(isScheduledJob
        ? {
          scheduleCron,
          scheduleTimezone,
          scheduleCommand,
          scheduleRetries,
          scheduleTimeout,
        }
        : {}),
      framework: selectedType === 'static-site' ? framework : undefined,
      installCommand: selectedType === 'static-site' ? installCommand : undefined,
      buildCommand: selectedType === 'static-site' ? buildCommand : undefined,
      outputDir: selectedType === 'static-site' ? outputDir : undefined,
      cacheTtl: selectedType === 'static-site' ? cacheTtl : undefined,
      environment: buildEnvironmentPayload(),
      scmCredentialId: resolvedScmCredentialId || undefined,
      registryCredentialId: resolvedRegistryCredentialId || undefined,
      secretProviderId: resolvedSecretProviderId || undefined,
      deployTemplateId,
      deploymentStrategy: {
        type: deployStrategyType,
        canaryPercent: canaryPercentValue,
        blueGreenPrimary,
      },
      minReplicas: Number(minReplicas),
      maxReplicas: Number(maxReplicas),
      profileId: profileId || undefined,
      autoDeploy,
      pauseOnIdle: selectedType === 'microservice' ? pauseOnIdle : false,
      pauseIdleTimeoutSeconds: selectedType === 'microservice' ? pauseIdleTimeoutSeconds : undefined,
    });

    toast({
      title: 'Service created',
      description: `Service "${serviceName}" was created successfully.`,
    });

    setIsLoading(false);
    navigate(`/services/${createdService.id}`);
  };

  return (
    <AppLayout>
      <CreateServiceFormStoreProvider value={createServiceFormStore}>
        <div className="space-y-6">
          <div className="space-y-3">
            {step === 'config' ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep('type');
                  setSelectedTemplateId(null);
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Service catalog
              </Button>
            ) : (
              <PageBackLink to={backLink} label={backLabel} />
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-foreground">Create service</h1>
                  <Badge variant="outline" className="text-xs">
                    {step === 'type' ? 'Step 1 of 2' : 'Step 2 of 2'}
                  </Badge>
                  {selectedType && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {selectedLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Select a service template and configure runtime, scaling, and deployment settings.
                </p>
              </div>
            </div>
          </div>

          {step === 'type' ? (
            <ServiceTemplateCatalogStep
              catalogQuery={catalogQuery}
              filteredTemplates={filteredServiceOptions}
              totalTemplates={serviceOptions.length}
              onCatalogQueryChange={setCatalogQuery}
              onManageTemplates={() => navigate('/settings')}
              onTemplateSelect={(option) => {
                setSelectedTemplateId(option.id);
                applyTemplateDefaults(option);
                setHealthCheckPath(templateHealthCheckPath(option) || '/healthz');
                setRepoMode(option.repoMode ?? 'template');
                setRepoUrl('');
                if (option.type === 'microservice' || option.type === 'static-site') {
                  setSourceType('git');
                }
                const optionPath = option.templateSource?.path ?? option.templatePath;
                if (optionPath) {
                  setRootDir(option.repoMode === 'template' ? '.' : optionPath);
                }
                setStep('config');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Service Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="serviceName">Service Name</Label>
                      <Input
                        id="serviceName"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder="docker-helloworld"
                        className="bg-muted/50 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <Select value={projectId} onValueChange={setProjectId} required>
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Select..." />
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
                  </div>
                </section>

                {selectedType === 'microservice' && (
                  <>
                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        {isTemplateMode ? 'Source' : 'Source Type'}
                      </h3>
                      {!isTemplateMode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSourceType('git')}
                            className={cn(
                              'h-full rounded-lg border px-4 py-3 text-left transition-colors',
                              sourceType === 'git'
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-muted/30 text-muted-foreground'
                            )}
                          >
                            <span className="text-sm font-medium">Git Repository</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              Build from a repo with Dockerfile
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSourceType('docker')}
                            className={cn(
                              'h-full rounded-lg border px-4 py-3 text-left transition-colors',
                              sourceType === 'docker'
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-muted/30 text-muted-foreground'
                            )}
                          >
                            <span className="text-sm font-medium">Docker Image</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              Deploy an existing image
                            </p>
                          </button>
                        </div>
                      )}

                      {sourceType === 'git' ? (
                        <div className="grid grid-cols-1 gap-4">
                          <RepositorySourceSection
                            allowTemplateToggle={!isTemplateMode && (selectedTemplate?.allowTemplateToggle ?? true)}
                            repoInputId="repoUrl"
                            repoPlaceholder="https://github.com/org/repo"
                            branchInputId="branch"
                            rootDirInputId="rootDir"
                          />
                          {repoMode === 'existing' ? (
                            <p className="text-xs text-muted-foreground">
                              SSH or HTTPS URL of the repository containing your Dockerfile.
                            </p>
                          ) : null}
                          {isTemplateMode ? (
                            <div className="rounded-lg border border-border p-4 space-y-2">
                              <Label htmlFor="targetImage">Target Images</Label>
                              <Input
                                id="targetImage"
                                value={templateImageValue}
                                onChange={(event) => setDockerImage(event.target.value)}
                                placeholder="registry.example.com/org/service:latest"
                                className="bg-muted/50 font-mono text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Additional tag: <span className="font-mono">{templateImageHash}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-border p-4 space-y-2">
                              <Label htmlFor="targetImage">Target Image</Label>
                              <Input
                                id="targetImage"
                                value={dockerImage}
                                onChange={(event) => setDockerImage(event.target.value)}
                                placeholder="registry.example.com/org/service:latest"
                                className="bg-muted/50 font-mono text-sm"
                                required
                              />
                              <p className="text-xs text-muted-foreground">
                                Image tag used when the worker builds and pushes this service.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border p-4 space-y-2">
                          <Label htmlFor="dockerImage">Docker Image</Label>
                          <Input
                            id="dockerImage"
                            value={dockerImage}
                            onChange={(e) => setDockerImage(e.target.value)}
                            placeholder="ghcr.io/org/service:latest"
                            className="bg-muted/50 font-mono text-sm"
                            required
                          />
                        </div>
                      )}
                    </section>

                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Runtime Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="port">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder="3000"
                            className="bg-muted/50 font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="healthCheck">Health Check Path</Label>
                          <Input
                            id="healthCheck"
                            value={healthCheckPath}
                            onChange={(e) => setHealthCheckPath(e.target.value)}
                            placeholder="/healthz"
                            className="bg-muted/50 font-mono"
                          />
                        </div>
                      </div>
                    </section>

                    {selectedTemplateKind === 'scheduled-job' && (
                      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
                          <p className="text-xs text-muted-foreground">
                            Runs as a Kubernetes CronJob with retries and job history managed automatically.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="scheduleCron">Cron expression</Label>
                            <Input
                              id="scheduleCron"
                              value={scheduleCron}
                              onChange={(e) => setScheduleCron(e.target.value)}
                              placeholder="0 2 * * *"
                              className="bg-muted/50 font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="scheduleTimezone">Timezone</Label>
                            <Input
                              id="scheduleTimezone"
                              value={scheduleTimezone}
                              onChange={(e) => setScheduleTimezone(e.target.value)}
                              placeholder="UTC"
                              className="bg-muted/50 font-mono"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="scheduleCommand">Job command</Label>
                            <Input
                              id="scheduleCommand"
                              value={scheduleCommand}
                              onChange={(e) => setScheduleCommand(e.target.value)}
                              placeholder="node scripts/run.js"
                              className="bg-muted/50 font-mono text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="scheduleRetries">Max retries</Label>
                            <Input
                              id="scheduleRetries"
                              type="number"
                              min="0"
                              value={scheduleRetries}
                              onChange={(e) => setScheduleRetries(e.target.value)}
                              className="bg-muted/50 font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="scheduleTimeout">Timeout (seconds)</Label>
                            <Input
                              id="scheduleTimeout"
                              type="number"
                              min="60"
                              value={scheduleTimeout}
                              onChange={(e) => setScheduleTimeout(e.target.value)}
                              className="bg-muted/50 font-mono"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Deployment Strategy</h3>
                        <p className="text-xs text-muted-foreground">
                          Define how traffic will shift for this microservice (implemented via Istio).
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Strategy</Label>
                          <Select
                            value={deployStrategyType}
                            onValueChange={(value) => setDeployStrategyType(value as DeployStrategyType)}
                          >
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Select strategy" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rolling">Rolling</SelectItem>
                              <SelectItem value="canary">Canary</SelectItem>
                              <SelectItem value="blue-green">Blue/Green</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {deployStrategyType === 'canary' && (
                          <div className="space-y-2">
                            <Label htmlFor="canaryPercent">Canary traffic (%)</Label>
                            <Input
                              id="canaryPercent"
                              type="number"
                              min="0"
                              max="100"
                              value={canaryPercent}
                              onChange={(e) => setCanaryPercent(e.target.value)}
                              className="bg-muted/50 font-mono"
                            />
                            <p className="text-xs text-muted-foreground">Percentage routed to the new version.</p>
                          </div>
                        )}
                        {deployStrategyType === 'blue-green' && (
                          <div className="space-y-2">
                            <Label>Active color</Label>
                            <Select value={blueGreenPrimary} onValueChange={(value) => setBlueGreenPrimary(value as 'blue' | 'green')}>
                              <SelectTrigger className="bg-muted/50">
                                <SelectValue placeholder="Select color" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="blue">Blue</SelectItem>
                                <SelectItem value="green">Green</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Traffic switches to the active pool.</p>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Operational Settings</h3>
                      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">Pause when idle</p>
                            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Coming soon</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Automatically scales to zero after the configured idle timeout without HTTP requests.
                          </p>
                        </div>
                        <Switch checked={false} disabled />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Profile Type</Label>
                          <Select value={profileId} onValueChange={setProfileId}>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue>
                                {selectedProfile
                                  ? `${selectedProfile.name} (${selectedProfile.cpu}, ${selectedProfile.memory})`
                                  : 'Select...'}
                              </SelectValue>
                            </SelectTrigger>

                            <SelectContent>
                              {profiles.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.name} ({profile.cpu}, {profile.memory})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>


                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="minReplicas">Minimum Replicas</Label>
                            <Input
                              id="minReplicas"
                              type="number"
                              min="1"
                              value={minReplicas}
                              onChange={(e) => setMinReplicas(e.target.value)}
                              className="bg-muted/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="maxReplicas">Maximum Replicas</Label>
                            <Input
                              id="maxReplicas"
                              type="number"
                              min="1"
                              value={maxReplicas}
                              onChange={(e) => setMaxReplicas(e.target.value)}
                              className="bg-muted/50"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <EnvironmentVariablesSection
                      title="Environment Variables"
                      description="Key-value pairs or secrets injected at build and runtime."
                      hint={
                        <>
                          For secrets, use references like{' '}
                          <span className="font-mono">{'vault://team/app/{{env}}#password'}</span>.
                        </>
                      }
                      envVars={envVars}
                      onAdd={addEnvVar}
                      onUpdate={updateEnvVar}
                      onRemove={removeEnvVar}
                    />

                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Advanced Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sourceType === 'git' && (
                          <div className="space-y-2">
                            <Label>SCM Credentials</Label>
                            <Select value={scmCredentialId} onValueChange={setScmCredentialId}>
                              <SelectTrigger className="bg-muted/50">
                                <SelectValue placeholder="Inherit project default" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inherit">Inherit project default</SelectItem>
                                {scopedScmCredentials.map((cred) => (
                                  <SelectItem key={cred.id} value={cred.id}>
                                    {cred.name} · {cred.provider || 'github'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Registry Credentials</Label>
                          <Select value={registryCredentialId} onValueChange={setRegistryCredentialId}>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Inherit project default" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Inherit project default</SelectItem>
                              {scopedRegistryCredentials.map((cred) => (
                                <SelectItem key={cred.id} value={cred.id}>
                                  {cred.name} · {cred.registryUrl || cred.provider || 'registry'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Secret Provider</Label>
                          <Select value={secretProviderId} onValueChange={setSecretProviderId}>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Inherit platform default" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Inherit platform default</SelectItem>
                              {secretProviders.map((provider) => (
                                <SelectItem key={provider.id} value={provider.id}>
                                  {provider.name} · {provider.type.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Secret values should use references (ex:{' '}
                            <span className="font-mono">{'vault://team/app/{{env}}#password'}</span>).
                          </p>
                        </div>
                        {sourceType === 'git' && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="dockerContext">Docker Context</Label>
                              <Input
                                id="dockerContext"
                                value={dockerContext}
                                onChange={(e) => setDockerContext(e.target.value)}
                                className="bg-muted/50 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="dockerfile">Dockerfile Path</Label>
                              <Input
                                id="dockerfile"
                                value={dockerfilePath}
                                onChange={(e) => setDockerfilePath(e.target.value)}
                                className="bg-muted/50 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="dockerCommand">Docker Command</Label>
                              <Input
                                id="dockerCommand"
                                value={dockerCommand}
                                onChange={(e) => setDockerCommand(e.target.value)}
                                placeholder="Override CMD/ENTRYPOINT"
                                className="bg-muted/50 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="preDeploy">Pre-Deploy Command</Label>
                              <Input
                                id="preDeploy"
                                value={preDeployCommand}
                                onChange={(e) => setPreDeployCommand(e.target.value)}
                                placeholder="e.g. npm run migrate"
                                className="bg-muted/50 font-mono text-sm"
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 md:col-span-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">Auto-deploy on new commits</p>
                                <p className="text-xs text-muted-foreground">Trigger deploys on repository updates.</p>
                              </div>
                              <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {selectedType === 'static-site' && (
                  <>
                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Source</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <RepositorySourceSection
                          allowTemplateToggle={!isTemplateMode && (selectedTemplate?.allowTemplateToggle ?? true)}
                          repoInputId="staticRepo"
                          repoPlaceholder="https://github.com/org/site"
                          branchInputId="staticBranch"
                          rootDirInputId="staticRoot"
                        />
                      </div>
                    </section>

                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Build Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Framework</Label>
                          <Select value={framework} onValueChange={setFramework}>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {frameworks.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="installCommand">Install Command</Label>
                          <Input
                            id="installCommand"
                            value={installCommand}
                            onChange={(e) => setInstallCommand(e.target.value)}
                            className="bg-muted/50 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="buildCommand">Build Command</Label>
                          <Input
                            id="buildCommand"
                            value={buildCommand}
                            onChange={(e) => setBuildCommand(e.target.value)}
                            className="bg-muted/50 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="outputDir">Output Directory</Label>
                          <Input
                            id="outputDir"
                            value={outputDir}
                            onChange={(e) => setOutputDir(e.target.value)}
                            className="bg-muted/50 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">CDN & Cache</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cacheTtl">Cache TTL (seconds)</Label>
                          <Input
                            id="cacheTtl"
                            value={cacheTtl}
                            onChange={(e) => setCacheTtl(e.target.value)}
                            className="bg-muted/50 font-mono text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Auto-deploy on new commits</p>
                            <p className="text-xs text-muted-foreground">Deploy a new build on updates.</p>
                          </div>
                          <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
                        </div>
                      </div>
                    </section>

                    <EnvironmentVariablesSection
                      title="Environment Variables"
                      description="Variables available during the build."
                      hint={
                        <>
                          Secret references are supported, e.g. <span className="font-mono">aws://payments-db#password</span>.
                        </>
                      }
                      envVars={envVars}
                      onAdd={addEnvVar}
                      onUpdate={updateEnvVar}
                      onRemove={removeEnvVar}
                    />
                  </>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => navigate('/services')} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitDisabled} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {isLoading ? 'Creating...' : isTemplateRepoChecking ? 'Checking repository...' : 'Create Service'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </CreateServiceFormStoreProvider>
    </AppLayout>
  );
}
