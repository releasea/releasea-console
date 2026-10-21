import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import {
  WorkflowDialogBody,
  WorkflowDialogContent,
  WorkflowDialogFooter,
  WorkflowDialogHeader,
} from '@/components/modals/WorkflowDialog';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RuntimeProfile, RuntimeProfilePayload } from '@/types/runtime-profile';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RuntimeProfilePayload) => void;
  loading?: boolean;
  profile?: RuntimeProfile | null;
}

const defaults: RuntimeProfilePayload = {
  name: '',
  description: '',
  cpu: '250m',
  cpuLimit: '500m',
  memory: '256Mi',
  memoryLimit: '512Mi',
};

export function RuntimeProfileFormModal({ open, onClose, onSubmit, loading, profile }: Props) {
  const [form, setForm] = useState<RuntimeProfilePayload>(defaults);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        description: profile.description ?? '',
        cpu: profile.cpu,
        cpuLimit: profile.cpuLimit,
        memory: profile.memory,
        memoryLimit: profile.memoryLimit,
      });
    } else {
      setForm(defaults);
    }
  }, [profile, open]);

  const update = <K extends keyof RuntimeProfilePayload>(key: K, value: RuntimeProfilePayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <WorkflowDialogContent size="md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <WorkflowDialogHeader
            title={profile ? 'Edit runtime profile' : 'Create runtime profile'}
            description="Set reusable Kubernetes requests and limits. Use values such as 250m for CPU and 256Mi for memory."
            icon={<Gauge className="h-4 w-4" />}
          />
          <WorkflowDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-name">Name</Label>
            <Input
              id="rp-name"
              placeholder="e.g. small, medium, large"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-desc">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="rp-desc"
              placeholder="When teams should use this profile"
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rp-cpu">CPU request</Label>
              <Input
                id="rp-cpu"
                placeholder="250m"
                value={form.cpu}
                onChange={(e) => update('cpu', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-cpu-limit">CPU limit</Label>
              <Input
                id="rp-cpu-limit"
                placeholder="500m"
                value={form.cpuLimit}
                onChange={(e) => update('cpuLimit', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rp-mem">Memory request</Label>
              <Input
                id="rp-mem"
                placeholder="256Mi"
                value={form.memory}
                onChange={(e) => update('memory', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-mem-limit">Memory limit</Label>
              <Input
                id="rp-mem-limit"
                placeholder="512Mi"
                value={form.memoryLimit}
                onChange={(e) => update('memoryLimit', e.target.value)}
                required
              />
            </div>
          </div>

          </WorkflowDialogBody>
          <WorkflowDialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? 'Saving...' : profile ? 'Save changes' : 'Create profile'}
            </Button>
          </WorkflowDialogFooter>
        </form>
      </WorkflowDialogContent>
    </Dialog>
  );
}
