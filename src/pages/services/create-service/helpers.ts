export const normalizeRepoName = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export const resolveGitBaseUrl = (provider?: string) => {
  const normalized = (provider || '').toLowerCase();
  if (normalized === 'gitlab') return 'https://gitlab.com';
  if (normalized === 'bitbucket') return 'https://bitbucket.org';
  return 'https://github.com';
};

export const normalizeRegistryHost = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return trimmed.replace(/^https?:\/\//, '').replace(/\/+$/, '');
};

export const resolveImageBase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lastColon = trimmed.lastIndexOf(':');
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastColon > lastSlash) {
    return trimmed.slice(0, lastColon);
  }
  return trimmed;
};

export const normalizeSecretValue = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('://')) return trimmed;
  return `secret://${trimmed}`;
};
