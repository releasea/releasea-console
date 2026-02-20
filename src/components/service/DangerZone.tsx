import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/layout/SettingsSection';

interface DangerZoneProps {
  title?: string;
  description?: string;
  actionLabel: string;
  actionDescription: string;
  onAction: () => void;
  isLoading?: boolean;
}

export function DangerZone({
  title = 'Danger zone',
  description,
  actionLabel,
  actionDescription,
  onAction,
  isLoading,
}: DangerZoneProps) {
  return (
    <SettingsSection title={title} description={description} variant="danger">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{actionLabel}</p>
          <p className="text-xs text-muted-foreground">{actionDescription}</p>
        </div>
        <Button variant="destructive" size="sm" onClick={onAction} disabled={isLoading} className="gap-2">
          <Trash2 className="w-4 h-4" />
          {isLoading ? 'Processing...' : actionLabel}
        </Button>
      </div>
    </SettingsSection>
  );
}
