import { describe, expect, it } from 'vitest';
import { getApplicationRepositoryUrl } from '@/lib/service-repository';

describe('getApplicationRepositoryUrl', () => {
  it('does not expose the default catalog repository as the application repository', () => {
    expect(getApplicationRepositoryUrl({ repoUrl: 'https://github.com/releasea/templates.git' })).toBe('');
    expect(getApplicationRepositoryUrl({ repoUrl: 'git@github.com:releasea/templates.git' })).toBe('');
  });

  it('uses template source metadata for custom catalogs', () => {
    expect(getApplicationRepositoryUrl({
      repoUrl: 'https://github.com/acme/platform-catalog',
      templateSource: { owner: 'acme', repo: 'platform-catalog', path: 'node-api' },
    })).toBe('');
  });

  it('returns a generated application repository', () => {
    const repositoryUrl = 'https://github.com/releasea/catalog-fastify-demo.git';
    expect(getApplicationRepositoryUrl({
      repoUrl: repositoryUrl,
      templateSource: { owner: 'releasea', repo: 'templates', path: 'api-node-fastify' },
    })).toBe(repositoryUrl);
  });
});
