import { useState } from 'react';
import { Plus, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const [memberError, setMemberError] = useState('');

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const addMember = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setMemberError('Enter an email address before adding a member.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMemberError('Enter a valid email address.');
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === email)) {
      setMemberError('This member is already included.');
      return;
    }
    setMembers([...members, { email, role: newRole }]);
    setNewEmail('');
    setNewRole('developer');
    setMemberError('');
  };

  const removeMember = (email: string) => {
    setMembers(members.filter(m => m.email !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const created = await performAction({
      endpoint: '/teams',
      method: 'POST',
      payload: { name, slug, members },
      label: 'createTeam',
    });
    
    if (!created) {
      setIsLoading(false);
      toast({
        title: 'Unable to create team',
        description: 'Review the team details and try again.',
        variant: 'destructive',
      });
      return;
    }

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
    setMemberError('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isLoading && !nextOpen) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create team</DialogTitle>
          <DialogDescription>
            Define the ownership group now. Member invitations are optional and can be sent later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team name</Label>
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
            <p className="text-xs text-muted-foreground">Add only the people who should receive access immediately.</p>
            <div className="flex gap-2">
              <Input
                aria-label="Member email"
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setMemberError(''); }}
                placeholder="email@example.com"
                className="bg-muted/50 flex-1"
              />
              <Select value={newRole} onValueChange={(value: InviteMember['role']) => setNewRole(value)}>
                <SelectTrigger className="w-32 bg-muted/50" aria-label="Member role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="icon" onClick={addMember} aria-label="Add member to invitation list">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {memberError && <p role="alert" className="text-xs text-destructive">{memberError}</p>}

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
                      aria-label={`Remove ${member.email} from invitation list`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || !slug.trim()} className="gap-2">
              <Plus className="w-4 h-4" />
              {isLoading ? 'Creating...' : 'Create team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
