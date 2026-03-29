import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/layout/SectionCard';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';
import type { ServiceReadinessScorecard as Scorecard } from '@/lib/service-readiness';
import { readinessStateClasses, readinessStateLabel } from './status-classes';

interface ReadinessScorecardProps {
  scorecard: Scorecard;
  loadingHints?: {
    gitOpsDrift?: boolean;
    gitOpsRepoPolicy?: boolean;
    deployPolicy?: boolean;
  };
}

export function ReadinessScorecard({ scorecard, loadingHints }: ReadinessScorecardProps) {
  return (
    <SectionCard
      title="Service readiness"
      description="Pre-deploy signals across delivery, governance, GitOps and operations."
      icon={<Activity className="w-4 h-4 text-primary" />}
      headerRight={
        <Badge variant="outline" className={cn('text-xs font-semibold', readinessStateClasses(scorecard.state))}>
          {scorecard.score}% ready
        </Badge>
      }
      contentClassName="p-0"
    >
      <div className="divide-y divide-border/60">
        {scorecard.sections.map((section) => {
          const loadingSuffix =
            section.id === 'gitops' && loadingHints?.gitOpsDrift
              ? ' · checking drift...'
              : section.id === 'gitops' && loadingHints?.gitOpsRepoPolicy
                ? ' · checking repo policy...'
                : section.id === 'governance' && loadingHints?.deployPolicy
                  ? ' · checking policy...'
                  : '';

          return (
            <div key={section.id} className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{section.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {section.score}% ready{loadingSuffix}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] uppercase tracking-wider', readinessStateClasses(section.state))}
                >
                  {readinessStateLabel(section.state)}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    section.state === 'ready'
                      ? 'bg-emerald-500'
                      : section.state === 'review'
                        ? 'bg-amber-500'
                        : 'bg-destructive',
                  )}
                  style={{ width: `${section.score}%` }}
                />
              </div>

              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded border border-border/40 bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.message}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 text-[9px] uppercase tracking-wider', readinessStateClasses(item.state))}
                    >
                      {readinessStateLabel(item.state)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
