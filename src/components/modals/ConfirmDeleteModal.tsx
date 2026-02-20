import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmPhrase?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDeleteModal({
  open,
  onOpenChange,
  title = 'Confirm deletion',
  description = 'This action cannot be undone.',
  confirmPhrase = 'delete',
  confirmLabel = 'Delete',
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue('');
      setIsLoading(false);
    }
  }, [open]);

  const isMatch = value.trim().toLowerCase() === confirmPhrase.toLowerCase();

  const handleConfirm = async () => {
    if (!isMatch || isLoading) return;
    setIsLoading(true);
    await Promise.resolve(onConfirm());
    setIsLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              Type <span className="font-mono text-foreground">{confirmPhrase}</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={confirmPhrase}
              className="bg-muted/50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!isMatch || isLoading} className="gap-2">
              <Trash2 className="w-4 h-4" />
              {isLoading ? 'Deleting...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
