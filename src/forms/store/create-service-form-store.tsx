import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { EnvVar } from '@/forms/types';
import type { RepoMode, SourceType } from '@/pages/services/create-service/catalog';

export type TemplateRepoAvailability = 'idle' | 'checking' | 'available' | 'exists' | 'error';

export type CreateServiceFormStore = {
  sourceType: SourceType;
  setSourceType: (value: SourceType) => void;
  repoMode: RepoMode;
  handleRepoModeChange: (mode: RepoMode) => void;
  repoUrl: string;
  setRepoUrl: (value: string) => void;
  branch: string;
  setBranch: (value: string) => void;
  rootDir: string;
  setRootDir: (value: string) => void;
  dockerImage: string;
  setDockerImage: (value: string) => void;
  isTemplateMode: boolean;
  templateRepoUrl: string;
  templateRepoAvailability: TemplateRepoAvailability;
  templateRepoAvailabilityMessage: string;
  envVars: EnvVar[];
  addEnvVar: () => void;
  updateEnvVar: (id: string, field: keyof EnvVar, value: string) => void;
  removeEnvVar: (id: string) => void;
};

const CreateServiceFormStoreContext = createContext<CreateServiceFormStore | null>(null);

export function CreateServiceFormStoreProvider({
  value,
  children,
}: {
  value: CreateServiceFormStore;
  children: ReactNode;
}) {
  return <CreateServiceFormStoreContext.Provider value={value}>{children}</CreateServiceFormStoreContext.Provider>;
}

export function useCreateServiceFormStore() {
  const context = useContext(CreateServiceFormStoreContext);
  if (!context) {
    throw new Error('useCreateServiceFormStore must be used within CreateServiceFormStoreProvider');
  }
  return context;
}
