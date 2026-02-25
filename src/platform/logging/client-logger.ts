import { AppConfig } from '@/lib/config';
import { redactForLogging, redactSensitiveText } from '@/platform/security/data-security';

type LogLevel = 'info' | 'warn' | 'error';

const emit = (level: LogLevel, event: string, message: string, context?: unknown): void => {
  if (!AppConfig.debug) {
    return;
  }

  const safeMessage = redactSensitiveText(message, {
    maskEmails: true,
    maskIPs: true,
    maxLength: 1000,
  });
  const prefix = `[${event}] ${safeMessage}`;
  const safeContext = context === undefined ? undefined : redactForLogging(context);

  if (level === 'info') {
    if (safeContext === undefined) {
      console.info(prefix);
      return;
    }
    console.info(prefix, safeContext);
    return;
  }
  if (level === 'warn') {
    if (safeContext === undefined) {
      console.warn(prefix);
      return;
    }
    console.warn(prefix, safeContext);
    return;
  }
  if (safeContext === undefined) {
    console.error(prefix);
    return;
  }
  console.error(prefix, safeContext);
};

export const clientLogger = {
  info: (event: string, message: string, context?: unknown) => {
    emit('info', event, message, context);
  },
  warn: (event: string, message: string, context?: unknown) => {
    emit('warn', event, message, context);
  },
  error: (event: string, message: string, context?: unknown) => {
    emit('error', event, message, context);
  },
};
