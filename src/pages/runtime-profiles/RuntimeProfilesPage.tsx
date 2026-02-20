import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Cpu, Pencil, Trash2, MemoryStick, MoreVertical } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { DataTable, Column } from '@/components/layout/DataTable';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  fetchRuntimeProfiles,
  createRuntimeProfile,
  updateRuntimeProfile,
  deleteRuntimeProfile,
} from '@/lib/data';
import type { RuntimeProfile, RuntimeProfilePayload } from '@/types/runtime-profile';
import { RuntimeProfileFormModal } from './RuntimeProfileFormModal';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';

export default function RuntimeProfilesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RuntimeProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<RuntimeProfile | null>(null);

  const { data: profiles = [] } = useQuery<RuntimeProfile[]>({
    queryKey: ['runtime-profiles'],
    queryFn: fetchRuntimeProfiles,
  });

  const createMutation = useMutation({
    mutationFn: (payload: RuntimeProfilePayload) => createRuntimeProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-profiles'] });
      toast.success('Runtime profile created');
      setFormOpen(false);
    },
    onError: () => toast.error('Failed to create profile'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RuntimeProfilePayload> }) =>
      updateRuntimeProfile(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-profiles'] });
      toast.success('Runtime profile updated');
      setEditingProfile(null);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRuntimeProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-profiles'] });
      toast.success('Runtime profile deleted');
      setDeletingProfile(null);
    },
    onError: () => toast.error('Failed to delete profile'),
  });

  const columns: Column<RuntimeProfile>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{item.name}</span>
          {item.description && (
            <span className="text-xs text-muted-foreground line-clamp-1">{item.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'cpu',
      header: 'CPU (req / limit)',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{item.cpu}</span>
          <span className="text-muted-foreground">/</span>
          <span>{item.cpuLimit}</span>
        </div>
      ),
    },
    {
      key: 'memory',
      header: 'Memory (req / limit)',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-sm">
          <MemoryStick className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{item.memory}</span>
          <span className="text-muted-foreground">/</span>
          <span>{item.memoryLimit}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'w-24 text-right',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingProfile(item)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeletingProfile(item)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <ListPageHeader
          title="Runtime Profiles"
          description="Reusable resource profiles (CPU, memory) that can be applied to services at deploy time."
          actions={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              New Profile
            </Button>
          }
        />

        <DataTable
          columns={columns}
          data={profiles}
          keyExtractor={(p) => p.id}
          emptyMessage="No runtime profiles yet"
          emptyDescription="Create a profile to define reusable resource configurations for your services."
          emptyIcon={<Cpu className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <RuntimeProfileFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        loading={createMutation.isPending}
      />

      {editingProfile && (
        <RuntimeProfileFormModal
          open
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSubmit={(payload) =>
            updateMutation.mutate({ id: editingProfile.id, payload })
          }
          loading={updateMutation.isPending}
        />
      )}

      <ConfirmDeleteModal
        open={!!deletingProfile}
        onOpenChange={(open) => !open && setDeletingProfile(null)}
        onConfirm={() => deletingProfile && deleteMutation.mutate(deletingProfile.id)}
        title="Delete Runtime Profile"
        description={`Are you sure you want to delete "${deletingProfile?.name}"? Services referencing this profile will need to be updated.`}
      />
    </AppLayout>
  );
}
