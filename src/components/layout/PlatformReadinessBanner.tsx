import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Cpu, Github, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchRegistryCredentials, fetchScmCredentials, fetchWorkers } from '@/lib/data';
import { Badge } from '@/components/ui/badge';

type PendingCheckKey = 'scm' | 'registry' | 'workers';

type PendingCheck = {
  key: PendingCheckKey;
  label: string;
  icon: LucideIcon;
};

const PENDING_CHECKS: PendingCheck[] = [
  { key: 'scm', label: 'Git provider credentials missing', icon: Github },
  { key: 'registry', label: 'Container registry credentials missing', icon: Package },
  { key: 'workers', label: 'No worker registered', icon: Cpu },
];

const REFRESH_INTERVAL_MS = 45000;

const resolvePendingLink = (key: PendingCheckKey): string => {
  if (key === 'scm') return '/settings?tab=credentials&focus=scm';
  if (key === 'registry') return '/settings?tab=credentials&focus=registry';
  return '/workers?action=register';
};

export function PlatformReadinessBanner() {
  const { hasPermission } = useAuth();
  const [pendingChecks, setPendingChecks] = useState<PendingCheckKey[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isAdmin = hasPermission('admin');

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const [scmCredentials, registryCredentials, workers] = await Promise.all([
        fetchScmCredentials(),
        fetchRegistryCredentials(),
        fetchWorkers(),
      ]);
      if (!mounted) return;

      const next: PendingCheckKey[] = [];
      if (scmCredentials.length === 0) next.push('scm');
      if (registryCredentials.length === 0) next.push('registry');
      if (workers.length === 0) next.push('workers');

      setPendingChecks(next);
      setIsLoaded(true);
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const pendingItems = useMemo(
    () => PENDING_CHECKS.filter((check) => pendingChecks.includes(check.key)),
    [pendingChecks],
  );

  if (!isLoaded || pendingItems.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-warning/30 bg-warning/5 px-6 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-warning/15 p-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Platform setup pending</p>
            <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
              {pendingItems.length} {pendingItems.length === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Click a pending item below to open the exact setup section.'
              : 'An administrator still needs to finish core platform configuration.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {pendingItems.map(({ key, label, icon: Icon }) => {
              const content = (
                <>
                  <Icon className="h-3.5 w-3.5 text-warning" />
                  <span>{label}</span>
                  {isAdmin && <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </>
              );
              const className =
                'inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-background/80 px-2 py-1 text-xs text-foreground';
              if (!isAdmin) {
                return (
                  <span key={key} className={className}>
                    {content}
                  </span>
                );
              }
              return (
                <Link
                  key={key}
                  to={resolvePendingLink(key)}
                  className={`${className} hover:border-warning/60 hover:bg-background`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
