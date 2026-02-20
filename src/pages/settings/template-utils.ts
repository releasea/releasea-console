import YAML from 'yaml';
import type { ServiceTemplate } from '@/types/releasea';

export const formatTemplateSource = (template: ServiceTemplate) => {
  const source = template.templateSource;
  if (!source || !source.owner || !source.repo) return 'Manual';
  const path = source.path ? `/${source.path}` : '';
  return `${source.owner}/${source.repo}${path}`;
};

export const formatTemplateType = (template: ServiceTemplate) => {
  if (template.templateKind === 'scheduled-job') return 'Scheduled job';
  if (template.type === 'static-site') return 'Static site';
  return 'Microservice';
};

export const formatTemplateMode = (template: ServiceTemplate) =>
  template.repoMode === 'existing' ? 'Existing repo' : 'Template repo';

export const parseTemplateImport = (raw: string): ServiceTemplate[] => {
  const parsed = YAML.parse(raw);
  if (!parsed) return [];
  return Array.isArray(parsed) ? (parsed as ServiceTemplate[]) : [parsed as ServiceTemplate];
};
