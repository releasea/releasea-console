import { Activity, AlertTriangle, CheckCircle2, Cpu, Settings2, ShieldAlert, Waypoints } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OperatorHealthLane, OperatorHealthReport as OperatorHealthReportModel } from '@/lib/operator-health';

const levelStyles: Record<'healthy' | 'review' | 'degraded', string> = {
  healthy: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  review: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  degraded: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
};

const laneIcon = (lane: OperatorHealthLane) => {
  switch (lane.id) {
    case 'providers':
      return <Settings2 className="h-4 w-4 text-primary" />;
    case 'workers':
      return <Cpu className="h-4 w-4 text-primary" />;
    case 'control-plane':
      return <Waypoints className="h-4 w-4 text-primary" />;
    case 'delivery':
      return <Activity className="h-4 w-4 text-primary" />;
    default:
      return <ShieldAlert className="h-4 w-4 text-primary" />;
  }
};

const levelLabel = (level: OperatorHealthLane['level']) => {
  switch (level) {
    case 'healthy':
      return 'Healthy';
    case 'review':
      return 'Review';
    case 'degraded':
      return 'Degraded';
    default:
      return level;
  }
};

export const OperatorHealthReport = ({ report }: { report: OperatorHealthReportModel }) => (
  <div className="rounded-lg border border-border bg-card overflow-hidden">
    <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Operator health report</h2>
          <Badge variant="outline" className={cn('text-[11px] normal-case', levelStyles[report.level])}>
            {levelLabel(report.level)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{report.summary}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {report.level === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
        Dashboard snapshot
      </div>
    </div>

    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
      {report.lanes.map((lane) => (
        <div key={lane.id} className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted/60 p-2 ring-1 ring-border/60">
                {laneIcon(lane)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{lane.label}</p>
                <p className="text-xs text-muted-foreground">{lane.summary}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn('text-[11px] normal-case', levelStyles[lane.level])}>
              {levelLabel(lane.level)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{lane.detail}</p>
          <Button asChild variant="outline" size="sm">
            <Link to={lane.href}>Open</Link>
          </Button>
        </div>
      ))}
    </div>
  </div>
);
