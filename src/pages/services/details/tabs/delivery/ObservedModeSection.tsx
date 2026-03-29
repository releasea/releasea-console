import { SectionCard } from '@/components/layout/SectionCard';
import { Eye } from 'lucide-react';
import { OBSERVED_MODE_RESTRICTIONS } from '@/lib/management-mode';

export function ObservedModeSection() {
  return (
    <SectionCard
      title="Observed mode operating rules"
      description="Releasea keeps visibility and inventory, but delivery control stays locked until the service becomes managed."
      icon={<Eye className="w-4 h-4 text-primary" />}
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {OBSERVED_MODE_RESTRICTIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </SectionCard>
  );
}
