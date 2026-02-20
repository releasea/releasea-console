import { useState } from 'react';
import { Plus, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { performAction } from '@/lib/data';

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

interface InviteMember {
  email: string;
  role: 'admin' | 'developer' | 'viewer';
}

export function CreateTeamModal({ open, onOpenChange, onCreated }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [members, setMembers] = useState<InviteMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [isLoading, setIsLoading] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const addMember = () => {
    if (newEmail && !members.find(m => m.email === newEmail)) {
      setMembers([...members, { email: newEmail, role: newRole }]);
      setNewEmail('');
      setNewRole('developer');
    }
  };

  const removeMember = (email: string) => {
    setMembers(members.filter(m => m.email !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await performAction({
      endpoint: '/teams',
      method: 'POST',
      payload: { name, slug, members },
      label: 'createTeam',
    });
    
    toast({
      title: 'Team created',
      description: `The "${name}" team was created. ${members.length} invitations sent.`,
    });
    
    setIsLoading(false);
    onOpenChange(false);
    resetForm();
    onCreated?.();
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setMembers([]);
    setNewEmail('');
    setNewRole('developer');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'developer': return 'Developer';
      case 'viewer': return 'Viewer';
      default: return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">New Team</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Core Platform"
              className="bg-muted/50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="core-platform"
              className="bg-muted/50 font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Invite Members</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="bg-muted/50 flex-1"
              />
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger className="w-32 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="icon" onClick={addMember}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {members.length > 0 && (
              <div className="space-y-2 mt-3">
                {members.map((member) => (
                  <div
                    key={member.email}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{member.email}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeMember(member.email)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              <Plus className="w-4 h-4" />
              {isLoading ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
