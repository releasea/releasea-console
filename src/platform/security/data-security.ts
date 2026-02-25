const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /(Bearer\s+)([A-Za-z0-9._-]+)/gi;
const KEY_VALUE_SECRET_PATTERN =
  /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*([^\s,;]+)/gi;
const EMAIL_PATTERN = /\b([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[\w.-]+\.[A-Za-z]{2,})\b/g;
const IPV4_PATTERN =
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const IPV6_PATTERN = /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g;
const SECRET_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|authorization|cookie|session|jwt)/i;
const ELLIPSIS = '...';

type RedactTextOptions = {
  maskEmails?: boolean;
  maskIPs?: boolean;
  maxLength?: number;
};

type SanitizeTextOptions = {
  maxLength?: number;
};

const trimLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - ELLIPSIS.length))}${ELLIPSIS}`;
};

const stripControlChars = (value: string): string => {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isDisallowedControl =
      (code >= 0 && code <= 8) ||
      (code >= 11 && code <= 31) ||
      code === 127;
    if (!isDisallowedControl) {
      output += value[index];
    }
  }
  return output;
};

export const sanitizeTextForRender = (value: unknown, options?: SanitizeTextOptions): string => {
  if (value == null) {
    return '';
  }
  const maxLength = Math.max(1, options?.maxLength ?? 4000);
  const asText = stripControlChars(String(value));
  return trimLength(asText, maxLength);
};

export const maskEmail = (value: string): string => {
  const normalized = value.trim();
  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return normalized;
  }
  const [localPart, domain] = parts;
  if (!localPart) {
    return `***@${domain}`;
  }
  if (localPart.length === 1) {
    return `*@${domain}`;
  }
  return `${localPart[0]}***@${domain}`;
};

export const maskIPAddress = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }
  if (normalized.includes('.')) {
    const segments = normalized.split('.');
    if (segments.length === 4) {
      return `${segments[0]}.${segments[1]}.${segments[2]}.***`;
    }
  }
  if (normalized.includes(':')) {
    const segments = normalized.split(':');
    if (segments.length >= 2) {
      const keep = segments.slice(0, Math.min(2, segments.length)).join(':');
      return `${keep}:****:****`;
    }
  }
  return normalized;
};

export const redactSensitiveText = (value: string, options?: RedactTextOptions): string => {
  const maxLength = Math.max(1, options?.maxLength ?? 4000);
  let output = sanitizeTextForRender(value, { maxLength });
  output = output.replace(BEARER_PATTERN, '$1[REDACTED]');
  output = output.replace(KEY_VALUE_SECRET_PATTERN, '$1=[REDACTED]');
  output = output.replace(JWT_PATTERN, '[JWT_REDACTED]');
  if (options?.maskEmails) {
    output = output.replace(
      EMAIL_PATTERN,
      (_match: string, firstChar: string, _rest: string, domain: string) => `${firstChar}***${domain}`,
    );
  }
  if (options?.maskIPs) {
    output = output.replace(IPV4_PATTERN, (match) => maskIPAddress(match));
    output = output.replace(IPV6_PATTERN, (match) => maskIPAddress(match));
  }
  return trimLength(output, maxLength);
};

const redactObjectValue = (value: unknown, depth: number): unknown => {
  if (value == null) {
    return value;
  }
  if (depth >= 4) {
    return '[TRUNCATED]';
  }
  if (typeof value === 'string') {
    return redactSensitiveText(value, { maskEmails: true, maskIPs: true, maxLength: 600 });
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => redactObjectValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 40);
    for (const [key, nestedValue] of entries) {
      result[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redactObjectValue(nestedValue, depth + 1);
    }
    return result;
  }
  return String(value);
};

export const redactForLogging = (value: unknown): unknown => redactObjectValue(value, 0);

type SanitizedExternalURL = {
  href: string | null;
  display: string;
};

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export const sanitizeExternalURL = (value: string): SanitizedExternalURL => {
  const trimmed = sanitizeTextForRender(value, { maxLength: 2048 }).trim();
  if (!trimmed) {
    return { href: null, display: '' };
  }

  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return { href: null, display: trimmed };
    }
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    const safeHref = parsed.toString();
    return {
      href: safeHref,
      display: sanitizeTextForRender(safeHref, { maxLength: 256 }),
    };
  } catch {
    return { href: null, display: trimmed };
  }
};
