import { useState } from 'react';
import { Rocket, AlertTriangle, GitBranch, Server } from 'lucide-react';
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
import { Service } from '@/types/releasea';
import { apiClient } from '@/lib/api-client';

interface ConfirmDeployModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  environment: string;
  version: string;
  onStart?: () => void;
  onError?: (message?: string) => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDeployModal({
  open,
  onOpenChange,
  service,
  environment,
  version,
  onStart,
  onError,
  onConfirm,
}: ConfirmDeployModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!service) return;
    setIsConfirming(true);
    onStart?.();
    const response = await apiClient.post<{ operation?: { id: string; status: string } }>(
      `/services/${service.id}/deploys`,
      { environment, version },
    );
    if (response.error) {
      onError?.(response.error);
      setIsConfirming(false);
      return;
    }
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      onError?.();
    } finally {
      setIsConfirming(false);
    }
  };

  if (!service) return null;

  const isProd = environment === 'prod';
  const ActionIcon = isProd ? AlertTriangle : Rocket;
  const displayVersion =
    /^[0-9a-f]{12,}$/i.test(version) && version.length > 8 ? version.substring(0, 8) : version;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[480px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isProd ? 'bg-warning/10' : 'bg-primary/10'}`}>
              {isProd ? (
                <AlertTriangle className="w-5 h-5 text-warning" />
              ) : (
                <Rocket className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                Confirm deployment
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Review the details before proceeding.
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
              <span className="font-mono text-sm text-foreground">{service.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="w-4 h-4" />
                <span>Version</span>
              </div>
              <span className="font-mono text-sm text-foreground">{displayVersion}</span>
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

          {isProd && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Production deployment</p>
                <p className="text-muted-foreground">
                  This will affect live users. Make sure the version has been tested.
                </p>
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`gap-2 ${isProd ? 'bg-warning text-warning-foreground hover:bg-warning/90' : ''}`}
          >
            <ActionIcon className="w-4 h-4" />
            {isConfirming ? 'Starting...' : 'Deploy now'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
