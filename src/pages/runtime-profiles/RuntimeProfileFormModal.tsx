import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit Runtime Profile' : 'New Runtime Profile'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="rp-desc">Description</Label>
            <Textarea
              id="rp-desc"
              placeholder="Optional description"
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rp-cpu">CPU Request</Label>
              <Input
                id="rp-cpu"
                placeholder="250m"
                value={form.cpu}
                onChange={(e) => update('cpu', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-cpu-limit">CPU Limit</Label>
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
              <Label htmlFor="rp-mem">Memory Request</Label>
              <Input
                id="rp-mem"
                placeholder="256Mi"
                value={form.memory}
                onChange={(e) => update('memory', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-mem-limit">Memory Limit</Label>
              <Input
                id="rp-mem-limit"
                placeholder="512Mi"
                value={form.memoryLimit}
                onChange={(e) => update('memoryLimit', e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? 'Saving...' : profile ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
