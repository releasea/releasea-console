const DEFAULT_DOCS_URL = 'https://docs.releasea.io';

function baseDocsUrl(): string {
  const envValue = (import.meta.env.RELEASEA_DOCS_URL as string | undefined)?.trim();
  return envValue && envValue.length > 0 ? envValue : DEFAULT_DOCS_URL;
}

export function getDocsUrl(slug?: string): string {
  const url = new URL(baseDocsUrl(), window.location.origin);
  const cleanSlug = (slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (cleanSlug) {
    url.searchParams.set('doc', cleanSlug);
  }
  return url.toString();
}
