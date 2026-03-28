import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, Github, Package, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProviderHealthCategory, ProviderStatusCategory } from '@/types/releasea';
import { summarizeProviderHealth, summarizeProviderReadiness } from '@/lib/onboarding';

type ReadinessCard = {
  id: 'scm' | 'registry' | 'secrets';
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  category?: ProviderStatusCategory;
  health?: ProviderHealthCategory;
};

interface ProviderReadinessChecksProps {
  isAdmin: boolean;
  scm?: ProviderStatusCategory;
  registry?: ProviderStatusCategory;
  secrets?: ProviderStatusCategory;
  health?: {
    scm?: ProviderHealthCategory;
    registry?: ProviderHealthCategory;
    secrets?: ProviderHealthCategory;
  };
  isRunningHealthChecks: boolean;
  onRunHealthChecks: () => void;
}

const readinessBadgeClass = (state: ReturnType<typeof summarizeProviderReadiness>['state']) => {
  if (state === 'configured') return 'border-success/30 bg-success/10 text-success';
  if (state === 'partial') return 'border-warning/30 bg-warning/10 text-warning';
  if (state === 'disabled') return 'border-border bg-muted/40 text-muted-foreground';
  return 'border-border bg-muted/40 text-muted-foreground';
};

export function ProviderReadinessChecks({
  isAdmin,
  scm,
  registry,
  secrets,
  health,
  isRunningHealthChecks,
  onRunHealthChecks,
}: ProviderReadinessChecksProps) {
  const cards: ReadinessCard[] = [
    {
      id: 'scm',
      title: 'SCM readiness',
      description: 'Used for template repositories, repository clones, and GitOps pull requests.',
      icon: Github,
      href: '/settings?tab=credentials&focus=scm',
      category: scm,
      health: health?.scm,
    },
    {
      id: 'registry',
      title: 'Registry readiness',
      description: 'Used for image push, image pull, and deploys from private registries.',
      icon: Package,
      href: '/settings?tab=credentials&focus=registry',
      category: registry,
      health: health?.registry,
    },
    {
      id: 'secrets',
      title: 'Secrets readiness',
      description: 'Recommended before onboarding more teams so services can resolve secret references safely.',
      icon: ShieldCheck,
      href: '/settings?tab=credentials',
      category: secrets,
      health: health?.secrets,
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Integration readiness</h2>
            <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">
              SCM, registry, secrets
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Configuration status is loaded automatically. Live checks validate real connectivity and credentials without
            leaving the onboarding flow.
          </p>
        </div>

        {isAdmin ? (
          <Button size="sm" variant="outline" className="gap-2" onClick={onRunHealthChecks} disabled={isRunningHealthChecks}>
            <Activity className="h-4 w-4" />
            {isRunningHealthChecks ? 'Running checks...' : 'Run live checks'}
          </Button>
        ) : (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
            Admin action
          </Badge>
        )}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {cards.map((card) => {
          const summary = summarizeProviderReadiness(card.category);
          const healthSummary = summarizeProviderHealth(card.health);
          const Icon = card.icon;
          const hasLiveFailure = (card.health?.unhealthy ?? 0) > 0;
          const hasLiveSuccess = (card.health?.healthy ?? 0) > 0 && !hasLiveFailure;

          return (
            <div key={card.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 rounded-md p-2 ${
                    hasLiveFailure
                      ? 'bg-destructive/10 text-destructive'
                      : hasLiveSuccess
                        ? 'bg-success/10 text-success'
                        : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {hasLiveSuccess ? <CheckCircle2 className="h-4 w-4" /> : hasLiveFailure ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{card.title}</p>
                    <Badge variant="outline" className={readinessBadgeClass(summary.state)}>
                      {summary.state === 'configured'
                        ? 'Configured'
                        : summary.state === 'partial'
                          ? 'Partial'
                          : summary.state === 'disabled'
                            ? 'Disabled'
                            : 'Not configured'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                  <p className="text-xs text-muted-foreground">{summary.message}</p>
                  <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {healthSummary}
                  </div>
                  {isAdmin ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={card.href}>Open settings</Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">An administrator must configure this category.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
