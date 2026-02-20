import type { ElementType } from 'react';
import { Clock, Globe, Server } from 'lucide-react';
import type { EnvVar } from '@/forms/types';
import type { ServiceType, ServiceTemplate as ServiceTemplatePayload } from '@/types/releasea';

export type { EnvVar };

export type ServiceKind = Exclude<ServiceType, 'worker'>;
export type SourceType = 'git' | 'docker';
export type RepoMode = 'template' | 'existing';
export type CatalogTemplate = Omit<ServiceTemplatePayload, 'icon'> & { icon: ElementType };

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
