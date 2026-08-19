import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_LOAD_FAILED_EVENT, API_LOAD_RECOVERED_EVENT, getApiLoadFailures, type ApiLoadFeedback } from '@/platform/http/api-feedback';

export function ApiLoadErrorBanner() {
  const [failures, setFailures] = useState<Record<string, string>>(getApiLoadFailures);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleFailure = (event: Event) => {
      const { resource, message } = (event as CustomEvent<ApiLoadFeedback>).detail;
      setFailures((current) => ({ ...current, [resource]: message || 'The platform returned an incomplete response.' }));
      setDismissed(false);
    };
    const handleRecovery = (event: Event) => {
      const { resource } = (event as CustomEvent<ApiLoadFeedback>).detail;
      setFailures((current) => {
        if (!(resource in current)) return current;
        const next = { ...current };
        delete next[resource];
        return next;
      });
    };
    window.addEventListener(API_LOAD_FAILED_EVENT, handleFailure);
    window.addEventListener(API_LOAD_RECOVERED_EVENT, handleRecovery);
    return () => {
      window.removeEventListener(API_LOAD_FAILED_EVENT, handleFailure);
      window.removeEventListener(API_LOAD_RECOVERED_EVENT, handleRecovery);
    };
  }, []);

  const resources = Object.keys(failures);
  if (dismissed || resources.length === 0) return null;

  return (
    <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Some platform data could not be loaded</p>
            <p className="text-xs text-muted-foreground">Empty lists may be incomplete. Affected resources: {resources.slice(0, 3).join(', ')}{resources.length > 3 ? ` and ${resources.length - 3} more` : ''}.</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => window.location.reload()}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDismissed(true)} aria-label="Dismiss data loading warning"><X className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
