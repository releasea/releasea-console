import type { ElementType } from 'react';
import { Clock, Globe, Server } from 'lucide-react';
import type { EnvVar } from '@/forms/types';
import type { ServiceType, ServiceTemplate as ServiceTemplatePayload } from '@/types/releasea';

export type { EnvVar };

export type ServiceKind = Exclude<ServiceType, 'worker'>;
export type SourceType = 'git' | 'docker';
export type RepoMode = 'template' | 'existing';
export type CatalogTemplate = Omit<ServiceTemplatePayload, 'icon'> & { icon: ElementType };
export type CatalogBlueprintId = 'service' | 'scheduled-job' | 'static-site';

export type CatalogBlueprint = {
  id: CatalogBlueprintId;
  label: string;
  description: string;
};

const templateIconMap: Record<string, ElementType> = {
  server: Server,
  globe: Globe,
  clock: Clock,
};

export const mapCatalogTemplates = (templates: ServiceTemplatePayload[]): CatalogTemplate[] =>
  templates.map((template) => {
    const key = (template.icon || '').trim().toLowerCase();
    return {
      ...template,
      highlights: Array.isArray(template.highlights) ? template.highlights : [],
      icon: templateIconMap[key] ?? Server,
    };
  });

export const frameworks = [
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vite', label: 'Vite' },
  { value: 'astro', label: 'Astro' },
  { value: 'hugo', label: 'Hugo' },
  { value: 'eleventy', label: 'Eleventy (11ty)' },
  { value: 'react', label: 'React SPA' },
];

export const catalogBlueprints: CatalogBlueprint[] = [
  {
    id: 'service',
    label: 'Services and APIs',
    description: 'Long-running services, APIs, and internal workloads that stay online and receive traffic.',
  },
  {
    id: 'scheduled-job',
    label: 'Scheduled Jobs',
    description: 'Cron-driven jobs for reports, ETL, cleanup, and recurring operational tasks.',
  },
  {
    id: 'static-site',
    label: 'Static Sites',
    description: 'Frontend and content sites with build output published through the platform CDN flow.',
  },
];

export const getCatalogBlueprintId = (template: ServiceTemplatePayload): CatalogBlueprintId => {
  if (template.templateKind === 'scheduled-job') return 'scheduled-job';
  if (template.type === 'static-site') return 'static-site';
  return 'service';
};

export const getCatalogBlueprint = (template: ServiceTemplatePayload): CatalogBlueprint =>
  catalogBlueprints.find((blueprint) => blueprint.id === getCatalogBlueprintId(template)) ?? catalogBlueprints[0];

export const getTemplateStarterFrameworkValue = (template: ServiceTemplatePayload): string => {
  const value = template.templateDefaults?.framework?.trim().toLowerCase();
  return value || '';
};

export const getTemplateStarterFrameworkLabel = (template: ServiceTemplatePayload): string => {
  const value = getTemplateStarterFrameworkValue(template);
  if (!value) return '';
  return frameworks.find((framework) => framework.value === value)?.label ?? value;
};
