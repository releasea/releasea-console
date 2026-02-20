export interface RuntimeProfile {
  id: string;
  name: string;
  description?: string;
  cpu: string;
  cpuLimit: string;
  memory: string;
  memoryLimit: string;
  environment?: string;
  labels?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type RuntimeProfilePayload = Omit<RuntimeProfile, 'id' | 'createdAt' | 'updatedAt'>;
