import { useEffect, useState } from 'react';
import { ArrowRightLeft, AlertTriangle, Server, ShieldAlert, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import type { DeployPolicyViolation } from '@/types/governance';

interface ConfirmSwitchBlueGreenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  environment: string;
  activeSlot: string;
  candidateSlot: string;
  policyViolations?: DeployPolicyViolation[];
  onConfirm: () => Promise<boolean> | boolean;
}

export function ConfirmSwitchBlueGreenModal({
  open,
  onOpenChange,
  serviceName,
  environment,
  activeSlot,
  candidateSlot,
  policyViolations = [],
  onConfirm,
}: ConfirmSwitchBlueGreenModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isProd = environment === 'prod';
  const fromLabel = activeSlot || 'blue';
  const toLabel = candidateSlot || 'green';

  useEffect(() => {
    if (!open) {
      setIsConfirming(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const shouldClose = await onConfirm();
      if (shouldClose) {
        onOpenChange(false);
      }
    } catch {
      // error handled by caller
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[480px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isProd ? 'bg-warning/10' : 'bg-primary/10'}`}>
              <ArrowRightLeft className={`w-5 h-5 ${isProd ? 'text-warning' : 'text-primary'}`} />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">Switch traffic</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Move all traffic from {fromLabel} to {toLabel}. The address stays published.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Server className="w-4 h-4" />
                <span>Service</span>
              </div>
              <span className="font-mono text-sm text-foreground">{serviceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Environment</span>
              <Badge variant={isProd ? 'destructive' : 'secondary'} className="text-xs uppercase">
                {environment}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Traffic</span>
              <span className="text-sm text-foreground">{fromLabel} to {toLabel}</span>
            </div>
          </div>

          {policyViolations.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">Blocked by deploy policy</p>
                <ul className="space-y-1 text-muted-foreground">
                  {policyViolations.map((violation, index) => (
                    <li key={`${violation.code}-${index}`}>{violation.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {isProd && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Production switch</p>
                <p className="text-muted-foreground">
                  All production traffic moves to {toLabel}. The previous slot is removed after the new one is live.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            The deploy only prepares {toLabel}. Nothing moves until you confirm this switch.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={isConfirming}
            className={`gap-2 ${isProd ? 'bg-warning text-warning-foreground hover:bg-warning/90' : ''}`}
          >
            {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            {isConfirming ? 'Starting...' : `Switch to ${toLabel}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
