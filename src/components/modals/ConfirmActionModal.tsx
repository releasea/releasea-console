import { useState, ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ActionVariant = 'destructive' | 'warning' | 'info' | 'success';

interface ConfirmActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  details?: ReactNode;
  variant?: ActionVariant;
  confirmPhrase?: string;
  confirmText?: string; // Alias for confirmPhrase for backwards compatibility
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
}

const variantConfig: Record<
  ActionVariant,
  { icon: typeof AlertTriangle; iconClass: string; borderClass: string; bgClass: string; buttonClass?: string }
> = {
  destructive: {
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    borderClass: 'border-destructive/30',
    bgClass: 'bg-destructive/10',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    borderClass: 'border-warning/30',
    bgClass: 'bg-warning/10',
    buttonClass: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
  info: {
    icon: Info,
    iconClass: 'text-primary',
    borderClass: 'border-primary/30',
    bgClass: 'bg-primary/10',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-success',
    borderClass: 'border-success/30',
    bgClass: 'bg-success/10',
  },
};

export function ConfirmActionModal({
  open,
  onOpenChange,
  title,
  description,
  details,
  variant = 'destructive',
  confirmPhrase,
  confirmText,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isLoading: externalLoading,
}: ConfirmActionModalProps) {
  // Support both confirmPhrase and confirmText (alias)
  const phraseToMatch = confirmPhrase || confirmText;
  const [value, setValue] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);

  const isLoading = externalLoading ?? internalLoading;
  const config = variantConfig[variant];
  const Icon = config.icon;

  const requiresPhrase = !!phraseToMatch;
  const isMatch = !requiresPhrase || value.trim().toLowerCase() === phraseToMatch?.toLowerCase();
  const canConfirm = isMatch && !isLoading;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setInternalLoading(true);
    try {
      await Promise.resolve(onConfirm());
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
      setValue('');
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setValue('');
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', config.bgClass)}>
              <Icon className={cn('w-5 h-5', config.iconClass)} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {details && (
            <div className={cn('rounded-lg border p-4', config.borderClass, config.bgClass)}>
              {details}
            </div>
          )}

          {requiresPhrase && (
            <div className="space-y-2">
              <Label htmlFor="confirm-phrase" className="text-sm">
                Type <span className="font-mono text-foreground">{phraseToMatch}</span> to confirm
              </Label>
              <Input
                id="confirm-phrase"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={phraseToMatch}
                className="bg-muted/50"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              className={cn('gap-2', config.buttonClass)}
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              <Icon className="w-4 h-4" />
              {isLoading ? 'Processing...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
