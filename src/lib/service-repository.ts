import type { Service } from '@/types/releasea';

const normalizeRepository = (value: string): string =>
  value
    .trim()
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
    .toLowerCase();

export const getApplicationRepositoryUrl = (service: Pick<Service, 'repoUrl' | 'templateSource'>): string => {
  const repositoryUrl = service.repoUrl?.trim() ?? '';
  if (!repositoryUrl) return '';

  const templateOwner = service.templateSource?.owner?.trim() || 'releasea';
  const templateRepo = service.templateSource?.repo?.trim() || 'templates';
  const templateRepositoryUrl = `https://github.com/${templateOwner}/${templateRepo}`;

  return normalizeRepository(repositoryUrl) === normalizeRepository(templateRepositoryUrl)
    ? ''
    : repositoryUrl;
};
