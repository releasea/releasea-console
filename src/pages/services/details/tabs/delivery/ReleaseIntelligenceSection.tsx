import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/layout/SectionCard';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, ShieldCheck } from 'lucide-react';
import type { ReleaseIntelligenceSummary } from '@/lib/release-intelligence';
import {
  sloStateClasses,
  rollbackClasses,
  rollbackConfidenceClasses,
  comparisonClasses,
  deployImpactClasses,
} from './status-classes';

interface ReleaseIntelligenceSectionProps {
  releaseIntelligence: ReleaseIntelligenceSummary | null;
}

function MetricCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DeltaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

export function ReleaseIntelligenceSection({ releaseIntelligence }: ReleaseIntelligenceSectionProps) {
  const ri = releaseIntelligence;
  const sloState = ri?.slo.overallState ?? 'unknown';
  const rbState = ri?.rollback.recommendation ?? 'insufficient-data';

  return (
    <SectionCard
      title="Release intelligence"
      description="Telemetry, SLO, and release comparison around the latest deploy."
      icon={<BarChart3 className="w-4 h-4 text-primary" />}
      headerRight={
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', sloStateClasses(sloState as any))}>
            SLO: {sloState}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', rollbackClasses(rbState as any))}>
            Rollback: {rbState.replace('-', ' ')}
          </Badge>
        </div>
      }
    >
      {!ri ? (
        <p className="text-sm text-muted-foreground">
          Release intelligence needs at least one successful deploy and a metrics window with telemetry.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Anomalies */}
          {ri.anomalies.length > 0 && (
            <div className="space-y-1.5">
              {ri.anomalies.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'rounded-md border px-3.5 py-2.5 text-sm',
                    a.severity === 'critical'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100'
                      : a.severity === 'warning'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                        : 'border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100',
                  )}
                >
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs opacity-90">{a.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* SLO Snapshot */}
          <div className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">SLO Snapshot</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MetricCell
                label="Availability"
                value={ri.slo.availabilityPct == null ? '--' : `${ri.slo.availabilityPct}%`}
                sub={`Target ${ri.slo.availabilityTargetPct}%`}
              />
              <MetricCell
                label="5xx error rate"
                value={ri.slo.errorRatePct == null ? '--' : `${ri.slo.errorRatePct}%`}
                sub="Current window"
              />
              <MetricCell
                label="Latency p95"
                value={ri.slo.latencyP95AvgMs == null ? '--' : `${ri.slo.latencyP95AvgMs} ms`}
                sub={`Target ${ri.slo.latencyTargetMs} ms`}
              />
            </div>
          </div>

          {/* Release Comparison */}
          <div className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Release Comparison</span>
              </div>
              <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', comparisonClasses(ri.comparison.verdict as any))}>
                {(ri.comparison.verdict ?? 'unknown').replace('-', ' ')}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-border/40 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">Latest release</p>
                <p className="font-mono text-sm text-foreground">{ri.latestReleaseLabel}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ri.latestDeployAt ? format(parseISO(ri.latestDeployAt), 'PPP p') : 'Unavailable'}
                </p>
              </div>
              <div className="rounded border border-border/40 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">Previous release</p>
                <p className="font-mono text-sm text-foreground">{ri.previousReleaseLabel ?? '--'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ri.previousDeployAt ? format(parseISO(ri.previousDeployAt), 'PPP p') : 'Unavailable'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <DeltaCell label="Latency delta" value={ri.comparison.latencyChangePct == null ? '--' : `${ri.comparison.latencyChangePct}%`} />
              <DeltaCell label="5xx delta" value={ri.comparison.errorRateChangePct == null ? '--' : `${ri.comparison.errorRateChangePct}%`} />
              <DeltaCell label="Availability delta" value={ri.comparison.availabilityChangePctPoints == null ? '--' : `${ri.comparison.availabilityChangePctPoints} pts`} />
            </div>
            <div className="rounded border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              {ri.comparison.summary}
            </div>
          </div>

          {/* Deploy Baseline */}
          <div className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Deploy Baseline</span>
            </div>
            {ri.baseline.available ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <DeltaCell label="Latency before" value={ri.baseline.latencyBeforeMs == null ? '--' : `${ri.baseline.latencyBeforeMs} ms`} />
                  <DeltaCell label="Latency after" value={ri.baseline.latencyAfterMs == null ? '--' : `${ri.baseline.latencyAfterMs} ms`} />
                  <DeltaCell label="5xx before" value={ri.baseline.errorRateBeforePct == null ? '--' : `${ri.baseline.errorRateBeforePct}%`} />
                  <DeltaCell label="5xx after" value={ri.baseline.errorRateAfterPct == null ? '--' : `${ri.baseline.errorRateAfterPct}%`} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>Latency change: <span className="font-medium text-foreground">{ri.baseline.latencyChangePct == null ? '--' : `${ri.baseline.latencyChangePct}%`}</span></div>
                  <div>5xx change: <span className="font-medium text-foreground">{ri.baseline.errorRateChangePct == null ? '--' : `${ri.baseline.errorRateChangePct}%`}</span></div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough telemetry to compute a baseline yet.</p>
            )}
            <div className="rounded border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              {ri.rollback.message}
            </div>
            <div className="rounded border border-border/40 bg-background/60 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Rollback confidence</span>
                <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', rollbackConfidenceClasses(ri.rollback.confidence))}>
                  {ri.rollback.confidence}
                </Badge>
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {ri.rollback.factors.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Deploy Impact Timeline */}
          <div className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Deploy Impact Timeline</span>
            </div>
            <div className="space-y-2">
              {ri.deployImpactTimeline.map((entry) => (
                <div key={entry.deployId} className="rounded border border-border/40 bg-background/60 p-3 space-y-2">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-sm text-foreground">{entry.releaseLabel}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {entry.deployedAt ? format(parseISO(entry.deployedAt), 'PPP p') : 'Unavailable'}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', deployImpactClasses(entry.impact))}>
                      {entry.impact.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <DeltaCell label="Latency before" value={entry.latencyBeforeMs == null ? '--' : `${entry.latencyBeforeMs} ms`} />
                    <DeltaCell label="Latency after" value={entry.latencyAfterMs == null ? '--' : `${entry.latencyAfterMs} ms`} />
                    <DeltaCell label="5xx before" value={entry.errorRateBeforePct == null ? '--' : `${entry.errorRateBeforePct}%`} />
                    <DeltaCell label="5xx after" value={entry.errorRateAfterPct == null ? '--' : `${entry.errorRateAfterPct}%`} />
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
