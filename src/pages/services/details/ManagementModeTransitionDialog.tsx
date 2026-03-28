import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export type ManagementTransitionRequirement = {
  id: string;
  label: string;
  description: string;
  ready: boolean;
};

type ManagementModeTransitionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  environmentLabel: string;
  requirements: ManagementTransitionRequirement[];
  onConfirm: () => void;
  isSaving?: boolean;
};

export function ManagementModeTransitionDialog({
  open,
  onOpenChange,
  serviceName,
  environmentLabel,
  requirements,
  onConfirm,
  isSaving = false,
}: ManagementModeTransitionDialogProps) {
  const blockingCount = requirements.filter((requirement) => !requirement.ready).length;
  const readyToManage = blockingCount === 0;
  const [takeoverConfirmed, setTakeoverConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setTakeoverConfirmed(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Switch to managed mode</DialogTitle>
          <DialogDescription>
            Review the operational requirements before Releasea starts deploying <span className="font-medium text-foreground">{serviceName}</span>{' '}
            in <span className="font-medium text-foreground">{environmentLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              readyToManage
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-warning/40 bg-warning/10 text-warning'
            }`}
          >
            {readyToManage
              ? 'All required checks passed. Confirm to save the current settings and hand deploy control back to Releasea.'
              : `${blockingCount} requirement${blockingCount === 1 ? '' : 's'} still need attention before this service can move to managed mode.`}
          </div>

          <div className="space-y-3">
            {requirements.map((requirement) => (
              <div
                key={requirement.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {requirement.ready ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-warning" />
                    )}
                    <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{requirement.description}</p>
                </div>
                <Badge variant={requirement.ready ? 'outline' : 'secondary'} className="shrink-0 text-xs normal-case">
                  {requirement.ready ? 'Ready' : 'Missing'}
                </Badge>
              </div>
            ))}
          </div>

          {readyToManage && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="takeover-confirmation"
                  checked={takeoverConfirmed}
                  onCheckedChange={(checked) => setTakeoverConfirmed(Boolean(checked))}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <label htmlFor="takeover-confirmation" className="text-sm font-medium text-foreground">
                    Confirm takeover
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I reviewed the current runtime, routing, and rollout ownership. After saving, Releasea becomes the deploy authority for {serviceName} in {environmentLabel}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!readyToManage || !takeoverConfirmed || isSaving}>
            {isSaving ? 'Saving...' : 'Save as managed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
