import { useState } from 'react';
import { TrendingUp, AlertTriangle, Server, BarChart3, ArrowRight } from 'lucide-react';
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

interface ConfirmPromoteCanaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  environment: string;
  canaryPercent: number;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmPromoteCanaryModal({
  open,
  onOpenChange,
  serviceName,
  environment,
  canaryPercent,
  onConfirm,
}: ConfirmPromoteCanaryModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const stablePercent = 100 - canaryPercent;
  const isProd = environment === 'prod';

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // error handled by caller
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[520px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isProd ? 'bg-warning/10' : 'bg-primary/10'}`}>
              <TrendingUp className={`w-5 h-5 ${isProd ? 'text-warning' : 'text-primary'}`} />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                Promote canary to 100%
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This will route all traffic to the canary version.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Service & environment info */}
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
              <Badge
                variant={isProd ? 'destructive' : 'secondary'}
                className="text-xs uppercase"
              >
                {environment}
              </Badge>
            </div>
          </div>

          {/* Traffic shift visualization */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Traffic shift
            </div>

            {/* Current state */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current</p>
              <div className="flex h-6 w-full rounded-md overflow-hidden border border-border">
                <div
                  className="bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground transition-all"
                  style={{ width: `${stablePercent}%` }}
                >
                  {stablePercent > 15 && `Stable ${stablePercent}%`}
                </div>
                <div
                  className="bg-primary/80 flex items-center justify-center text-[10px] font-medium text-primary-foreground transition-all"
                  style={{ width: `${canaryPercent}%` }}
                >
                  {canaryPercent > 15 && `Canary ${canaryPercent}%`}
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* After promote */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">After promote</p>
              <div className="flex h-6 w-full rounded-md overflow-hidden border border-primary/40">
                <div className="bg-primary flex items-center justify-center text-[10px] font-medium text-primary-foreground w-full">
                  New version 100%
                </div>
              </div>
            </div>
          </div>

          {/* Warning for prod */}
          {isProd && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Production promotion</p>
                <p className="text-muted-foreground">
                  All production traffic will be served by the canary version.
                  Ensure the canary has been validated before promoting.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Your default canary percentage ({canaryPercent}%) will be preserved for the next deploy.
            The canary deployment will be removed after traffic is fully shifted.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`gap-2 ${isProd ? 'bg-warning text-warning-foreground hover:bg-warning/90' : ''}`}
          >
            <TrendingUp className="w-4 h-4" />
            {isConfirming ? 'Promoting...' : 'Promote to 100%'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
