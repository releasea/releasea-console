import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { DeployStrategyType, Project, RegistryCredential, ScmCredential, SecretProvider, Service } from '@/types/releasea';
import type { RuntimeProfile } from '@/types/runtime-profile';
import type { EnvVar } from '@/forms/types';

export type ServiceSettingsFormStore = {
  service: Service;
  projects: Project[];
  projectId: string;
  onProjectChange: (value: string) => void;
  source: {
    type: 'git' | 'docker';
    setType: (value: 'git' | 'docker') => void;
    repoUrl: string;
    setRepoUrl: (value: string) => void;
    branch: string;
    setBranch: (value: string) => void;
    rootDir: string;
    setRootDir: (value: string) => void;
    dockerImage: string;
    setDockerImage: (value: string) => void;
    dockerContext: string;
    setDockerContext: (value: string) => void;
    dockerfilePath: string;
    setDockerfilePath: (value: string) => void;
    dockerCommand: string;
    setDockerCommand: (value: string) => void;
    preDeployCommand: string;
    setPreDeployCommand: (value: string) => void;
    autoDeploy: boolean;
    setAutoDeploy: (value: boolean) => void;
  };
  runtime: {
    servicePort: string;
    setServicePort: (value: string) => void;
    healthCheckPath: string;
    setHealthCheckPath: (value: string) => void;
  };
  deployment: {
    deployStrategyType: DeployStrategyType;
    setDeployStrategyType: (value: DeployStrategyType) => void;
    canaryPercent: string;
    setCanaryPercent: (value: string) => void;
    blueGreenPrimary: 'blue' | 'green';
    setBlueGreenPrimary: (value: 'blue' | 'green') => void;
  };
  operations: {
    pauseOnIdle: boolean;
    setPauseOnIdle: (value: boolean) => void;
    pauseIdleTimeoutMinutes: string;
    setPauseIdleTimeoutMinutes: (value: string) => void;
    profileId: string;
    setProfileId: (value: string) => void;
    profiles: RuntimeProfile[];
    minReplicas: string;
    setMinReplicas: (value: string) => void;
    maxReplicas: string;
    setMaxReplicas: (value: string) => void;
  };
  envVars: {
    items: EnvVar[];
    add: () => void;
    update: (id: string, field: keyof EnvVar, value: string) => void;
    remove: (id: string) => void;
  };
  credentials: {
    serviceScmCredentialId: string;
    setServiceScmCredentialId: (value: string) => void;
    serviceRegistryCredentialId: string;
    setServiceRegistryCredentialId: (value: string) => void;
    serviceSecretProviderId: string;
    setServiceSecretProviderId: (value: string) => void;
    scopedScmCredentials: ScmCredential[];
    scopedRegistryCredentials: RegistryCredential[];
    secretProviders: SecretProvider[];
    credentialScopeLabel: (scope: string) => string;
  };
  staticSite: {
    framework: string;
    setFramework: (value: string) => void;
    installCommand: string;
    setInstallCommand: (value: string) => void;
    buildCommand: string;
    setBuildCommand: (value: string) => void;
    outputDir: string;
    setOutputDir: (value: string) => void;
    cacheTtl: string;
    setCacheTtl: (value: string) => void;
  };
  scheduledJob: {
    enabled: boolean;
    scheduleCron: string;
    setScheduleCron: (value: string) => void;
    scheduleTimezone: string;
    setScheduleTimezone: (value: string) => void;
    scheduleCommand: string;
    setScheduleCommand: (value: string) => void;
    scheduleRetries: string;
    setScheduleRetries: (value: string) => void;
    scheduleTimeout: string;
    setScheduleTimeout: (value: string) => void;
  };
  settingsSaving: boolean;
  onSubmit: (event?: React.FormEvent) => void;
  onDiscard: () => void;
  isServiceActive: boolean;
  onToggleServiceActive: () => void;
  onDeleteService: () => void;
};

const ServiceSettingsFormStoreContext = createContext<ServiceSettingsFormStore | null>(null);

export function ServiceSettingsFormStoreProvider({
  value,
  children,
}: {
  value: ServiceSettingsFormStore;
  children: ReactNode;
}) {
  return <ServiceSettingsFormStoreContext.Provider value={value}>{children}</ServiceSettingsFormStoreContext.Provider>;
}

export function useServiceSettingsFormStore() {
  const context = useContext(ServiceSettingsFormStoreContext);
  if (!context) {
    throw new Error('useServiceSettingsFormStore must be used within ServiceSettingsFormStoreProvider');
  }
  return context;
}
