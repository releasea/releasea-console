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

export type RepositoryReference = {
  host: string;
  owner: string;
  name: string;
};

export const parseRepositoryReference = (value: string): RepositoryReference | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      host: sshMatch[1].toLowerCase(),
      owner: sshMatch[2],
      name: sshMatch[3].replace(/\.git$/i, ''),
    };
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const name = parts[1].replace(/\.git$/i, '');
    if (!owner || !name) return null;
    return {
      host: parsed.hostname.toLowerCase(),
      owner,
      name,
    };
  } catch {
    return null;
  }
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
