import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/layout/SectionCard';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle } from 'lucide-react';
import type { DeployPolicyPreflight } from '@/types/governance';
import { policyStatusClasses, policyStatusLabel } from './status-classes';

interface DeployPolicySectionProps {
  viewEnvLabel: string;
  deployPolicyPreflight: DeployPolicyPreflight | null;
  deployPolicyPreflightLoading: boolean;
}

export function DeployPolicySection({
  viewEnvLabel,
  deployPolicyPreflight,
  deployPolicyPreflightLoading,
}: DeployPolicySectionProps) {
  const violations = deployPolicyPreflight?.violations ?? [];
  const exceptions = deployPolicyPreflight?.exceptionsApplied ?? [];
  const dryRun = deployPolicyPreflight?.dryRun === true;

  const statusCls = policyStatusClasses(violations.length, dryRun, exceptions.length);
  const statusLbl = policyStatusLabel(violations.length, dryRun, exceptions.length, deployPolicyPreflightLoading);

  return (
    <SectionCard
      title="Deploy policy preflight"
      description={`Governance blockers for ${viewEnvLabel} before the deploy modal is opened.`}
      icon={<Shield className="w-4 h-4 text-primary" />}
      headerRight={
        <Badge variant="outline" className={cn('text-xs uppercase tracking-wider', statusCls)}>
          {statusLbl}
        </Badge>
      }
    >
      {deployPolicyPreflightLoading ? (
        <p className="text-sm text-muted-foreground">Checking deploy policy for {viewEnvLabel}...</p>
      ) : violations.length > 0 ? (
        <div
          className={cn(
            'rounded-md px-3.5 py-3 text-sm',
            dryRun
              ? 'border border-amber-500/40 bg-amber-500/5'
              : 'border border-destructive/40 bg-destructive/5',
          )}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">
                {dryRun ? 'Current warnings (dry-run)' : 'Current blockers'}
              </p>
              <ul className="space-y-1 text-muted-foreground">
                {violations.map((v, i) => (
                  <li key={`${v.code}-${i}`} className="text-xs leading-relaxed">{v.message}</li>
                ))}
              </ul>
              {exceptions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {exceptions.length} temporary exception(s) are already applied, but blockers still remain.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : exceptions.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3.5 py-3 text-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">Temporary exceptions are active</p>
              <ul className="space-y-1 text-muted-foreground">
                {exceptions.map((ex) => (
                  <li key={ex.id} className="text-xs leading-relaxed">
                    {ex.reason || 'Temporary exception active'} until {format(parseISO(ex.expiresAt), 'PPP p')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No governance blockers are active for the selected environment.</p>
      )}
    </SectionCard>
  );
}
