import { useEffect, useState } from 'react';
import { Plus, Layers, Settings2, Trash2, Server, CheckCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { ConfirmActionModal } from '@/components/modals/ConfirmActionModal';
import { EnvironmentConfig, Environment } from '@/types/releasea';
import { saveEnvironmentConfigs, resolveNamespace } from '@/lib/environments';
import { toast } from '@/hooks/use-toast';
import { fetchEnvironments, fetchEnvironmentLock, fetchWorkers, fetchDeploys, fetchServices, performAction } from '@/lib/data';

interface ExtendedEnvironment extends EnvironmentConfig {
  color: string;
  isDefault: boolean;
  workersCount: number;
  servicesCount: number;
  deploysToday: number;
}

const Environments = () => {
  const [baseConfigs, setBaseConfigs] = useState<EnvironmentConfig[]>([]);
  const [environments, setEnvironments] = useState<ExtendedEnvironment[]>([]);

  const [selectedEnv, setSelectedEnv] = useState<ExtendedEnvironment | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteEnv, setDeleteEnv] = useState<ExtendedEnvironment | null>(null);

  // Lock state
  const [editLocked, setEditLocked] = useState(false);
  const [editLockReason, setEditLockReason] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const defaultColors: Record<string, string> = {
    dev: '#22c55e',
    staging: '#f59e0b',
    prod: '#ef4444',
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [configs, workers, services, deploys] = await Promise.all([
        fetchEnvironments(),
        fetchWorkers(),
        fetchServices(),
        fetchDeploys(),
      ]);
      if (!active) return;
      setBaseConfigs(configs);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const extended: ExtendedEnvironment[] = configs.map((config) => ({
        ...config,
        color: (config as { color?: string }).color || defaultColors[config.id] || '#3b82f6',
        isDefault: (config as { isDefault?: boolean }).isDefault ?? config.id === 'prod',
        workersCount: workers.filter((w) => w.environment === config.id).length,
        servicesCount: services.length, // services are not env-scoped in the data model
        deploysToday: deploys.filter(
          (d) => d.environment === config.id && d.startedAt && new Date(d.startedAt) >= todayStart
        ).length,
      }));

      setEnvironments(extended);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleEdit = async (env: ExtendedEnvironment) => {
    setSelectedEnv(env);
    setFormName(env.name);
    setFormDescription(env.description || '');
    setFormColor(env.color);
    setFormIsDefault(env.isDefault);
    setEditLocked(false);
    setEditLockReason('');
    setIsEditOpen(true);

    const lock = await fetchEnvironmentLock(env.id);
    setEditLocked(lock.locked);
    setEditLockReason(lock.reason);
  };

  const handleCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormColor('#3b82f6');
    setFormIsDefault(false);
    setIsCreateOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEnv) return;
    await performAction({
      endpoint: `/environments/${selectedEnv.id}`,
      method: 'PUT',
      payload: { name: formName, description: formDescription, color: formColor, isDefault: formIsDefault },
      label: 'updateEnvironment',
    });

    setEnvironments(prev => prev.map(env => 
      env.id === selectedEnv.id 
        ? { ...env, name: formName, description: formDescription, color: formColor, isDefault: formIsDefault }
        : formIsDefault ? { ...env, isDefault: false } : env
    ));
    
    // Also update the base configs
    const updatedConfigs = baseConfigs.map(c => 
      c.id === selectedEnv.id ? { ...c, name: formName, description: formDescription } : c
    );
    saveEnvironmentConfigs(updatedConfigs);
    setBaseConfigs(updatedConfigs);
    
    setIsEditOpen(false);
    toast({ title: 'Environment updated', description: `${formName} has been saved.` });
  };

  const handleSaveCreate = async () => {
    const newId = formName.toLowerCase().replace(/\s+/g, '-') as Environment;
    const newEnv: ExtendedEnvironment = {
      id: newId,
      name: formName,
      description: formDescription,
      color: formColor,
      isDefault: formIsDefault,
      workersCount: 0,
      servicesCount: 0,
      deploysToday: 0,
    };
    await performAction({
      endpoint: '/environments',
      method: 'POST',
      payload: newEnv,
      label: 'createEnvironment',
    });

    setEnvironments(prev => 
      formIsDefault 
        ? [...prev.map(e => ({ ...e, isDefault: false })), newEnv]
        : [...prev, newEnv]
    );
    const nextConfigs = [
      ...baseConfigs,
      { id: newId, name: formName, description: formDescription },
    ];
    saveEnvironmentConfigs(nextConfigs);
    setBaseConfigs(nextConfigs);
    
    setIsCreateOpen(false);
    toast({ title: 'Environment created', description: `${formName} has been added.` });
  };

  const handleDelete = async () => {
    if (!deleteEnv) return;
    await performAction({
      endpoint: `/environments/${deleteEnv.id}`,
      method: 'DELETE',
      label: 'deleteEnvironment',
    });

    setEnvironments(prev => prev.filter(e => e.id !== deleteEnv.id));
    setBaseConfigs((prev) => prev.filter((config) => config.id !== deleteEnv.id));
    setDeleteEnv(null);
    toast({ title: 'Environment deleted', description: `${deleteEnv.name} has been removed.` });
  };

  const defaultEnvironment = environments.find((env) => env.isDefault);

  const colorPresets = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <ListPageHeader
          title="Environments"
          description="Manage deployment environments for your services and workers"
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                New environment
              </Button>
            </div>
          }
        />

        {/* Environment Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((env) => (
            <div
              key={env.id}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => handleEdit(env)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${env.color}20` }}
                  >
                    <Layers className="w-5 h-5" style={{ color: env.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{env.name}</h3>
                      {env.isDefault && (
                        <Badge variant="secondary" className="text-[10px]">DEFAULT</Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{env.id} &rarr; {resolveNamespace(env.id)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(env);
                  }}
                >
                  <Settings2 className="w-4 h-4" />
                </Button>
              </div>

              {env.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {env.description}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{env.workersCount}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workers</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{env.servicesCount}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Services</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{env.deploysToday}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deploys</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SectionCard
          title="Operational guidance"
          description="Clarify how environments map to deploys, workers, and release flow"
          icon={<Settings2 className="w-5 h-5 text-primary" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">DEFAULT</Badge>
                <p className="font-medium text-foreground">
                  {defaultEnvironment?.name ?? 'Not set'}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                New services will target the default environment unless a different one is chosen.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-info" />
                <p className="font-medium text-foreground">Worker targeting</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Deploys are scheduled only on workers that match the selected environment.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="font-medium text-foreground">Promotion flow</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Use Dev → Staging → Production to validate changes before impacting users.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Info Section */}
        <SectionCard
          title="About Environments"
          description="How environments work in Releasea"
          icon={<Server className="w-5 h-5 text-primary" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="font-medium text-foreground">Isolation</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Each environment has isolated workers, services, and deployment pipelines.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="font-medium text-foreground">Promotion</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Deploy configurations can be promoted from dev to staging to production.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="font-medium text-foreground">Access Control</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Team permissions can be scoped per environment for security.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Environment</DialogTitle>
            <DialogDescription>
              Update the environment configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEnv && (
              <div className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-3 py-2">
                Namespace: <span className="text-foreground">{resolveNamespace(selectedEnv.id)}</span>
              </div>
            )}
            {editLocked && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive font-medium">Environment locked</p>
                <p className="text-xs text-destructive/80 mt-1">{editLockReason}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="bg-muted/50"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-lg transition-all ${formColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Default environment</Label>
                <p className="text-xs text-muted-foreground">New services will use this environment</p>
              </div>
              <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              disabled={editLocked}
              onClick={() => {
                setIsEditOpen(false);
                setDeleteEnv(selectedEnv);
              }}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Environment</DialogTitle>
            <DialogDescription>
              Add a new deployment environment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formName.trim() && (
              <div className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-3 py-2">
                Will map to namespace: <span className="text-foreground">{resolveNamespace(formName.toLowerCase().replace(/\s+/g, '-'))}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="create-name">Display name</Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., QA Testing"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What is this environment used for?"
                className="bg-muted/50"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-lg transition-all ${formColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Default environment</Label>
                <p className="text-xs text-muted-foreground">New services will use this environment</p>
              </div>
              <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCreate} disabled={!formName.trim()} className="gap-2">
              <Plus className="w-4 h-4" />
              Create environment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmActionModal
        open={!!deleteEnv}
        onOpenChange={() => setDeleteEnv(null)}
        title="Delete Environment"
        description={`This will permanently delete the "${deleteEnv?.name}" environment. All associated workers and services must be reassigned first.`}
        confirmText={deleteEnv?.id || ''}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
};

export default Environments;
