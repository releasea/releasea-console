import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { ConfirmDeployModal } from '@/components/modals/ConfirmDeployModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { getEnvironmentLabel } from '@/lib/environments';
import { cn } from '@/lib/utils';
import type { Deploy, ManagedRule, RulePolicyConfig, Service } from '@/types/releasea';
import { format } from 'date-fns';
import { CheckCircle, Copy, Plus, Rocket, Trash2, X } from 'lucide-react';
import {
  getGatewayTargets,
  getPublicationLabel,
  ruleMethods,
} from './constants';
import type { PublicationTargets, RuleRow } from './types';

const renderStatusBadge = (status: Deploy['status']) => (
  <StatusBadge status={status} className="normal-case" />
);

type ServiceDetailsDialogsProps = {
  deployVersion: {
    open: boolean;
    setOpen: (open: boolean) => void;
    viewEnvLabel: string;
    latestVersionLabel: string;
    deployVersion: string;
    setDeployVersion: (value: string) => void;
    versionOptions: { value: string; label: string; meta: string }[];
    onDeploySpecific: () => void;
  };
  deployLog: {
    open: boolean;
    setOpen: (open: boolean) => void;
    selected: Deploy | null;
    setSelected: (deploy: Deploy | null) => void;
    deployEnvLabel: (env?: string) => string;
  };
  createRule: {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose: () => void;
    viewEnv: string;
    newRuleName: string;
    setNewRuleName: (value: string) => void;
    newRuleAction: RulePolicyConfig['action'];
    setNewRuleAction: (value: RulePolicyConfig['action']) => void;
    newRuleMethods: string[];
    toggleNewRuleMethod: (method: string) => void;
    newRulePathDraft: string;
    setNewRulePathDraft: (value: string) => void;
    addNewRulePath: () => void;
    newRulePaths: string[];
    removeNewRulePath: (path: string) => void;
    newRulePublishTargets: PublicationTargets;
    setNewRulePublishTargets: (value: PublicationTargets) => void;
    onConfirm: () => void;
  };
  editRule: {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose: () => void;
    viewEnv: string;
    editingRule: ManagedRule | null;
    editRuleName: string;
    setEditRuleName: (value: string) => void;
    editRuleAction: RulePolicyConfig['action'];
    setEditRuleAction: (value: RulePolicyConfig['action']) => void;
    editRuleMethods: string[];
    toggleEditRuleMethod: (method: string) => void;
    editRulePathDraft: string;
    setEditRulePathDraft: (value: string) => void;
    addEditRulePath: () => void;
    editRulePaths: string[];
    removeEditRulePath: (path: string) => void;
    onOpenCopyFromEdit: () => void;
    onDeleteRuleFromEdit: () => void;
    onConfirm: () => void;
  };
  copyRule: {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose: () => void;
    copyRule: ManagedRule | null;
    viewEnv: string;
    environmentOptions: { id: string; name: string }[];
    copyRuleEnvs: string[];
    toggleCopyRuleEnvironment: (envId: string) => void;
    onConfirm: () => void;
  };
  publishRule: {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose: () => void;
    publishRule: ManagedRule | null;
    viewEnv: string;
    publishTargets: PublicationTargets;
    setPublishTargets: (value: PublicationTargets) => void;
    onConfirm: () => void;
  };
  deleteRule: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selected: RuleRow | null;
    onConfirm: () => void;
  };
  deleteService: {
    open: boolean;
    setOpen: (open: boolean) => void;
    service: Service | undefined;
    onConfirm: () => void;
  };
  confirmDeploy: {
    open: boolean;
    setOpen: (open: boolean) => void;
    service: Service;
    viewEnv: string;
    pendingVersion: string | null;
    onStart: () => void;
    onError: (message?: string) => void;
    onConfirm: () => Promise<void> | void;
  };
};

export const ServiceDetailsDialogs = ({
  deployVersion,
  deployLog,
  createRule,
  editRule,
  copyRule,
  publishRule,
  deleteRule,
  deleteService,
  confirmDeploy,
}: ServiceDetailsDialogsProps) => {
  const hasPublishTargets = publishRule.publishTargets.internal || publishRule.publishTargets.external;
  const publishSummaryLabel = getPublicationLabel(publishRule.publishTargets);

  return (
    <>
      <Dialog open={deployVersion.open} onOpenChange={deployVersion.setOpen}>
        <DialogContent className="sm:max-w-[520px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Deploy specific version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Target environment</p>
              <p className="text-sm font-medium text-foreground">{deployVersion.viewEnvLabel}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Latest version: {deployVersion.latestVersionLabel}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Version</Label>
              <Select value={deployVersion.deployVersion} onValueChange={deployVersion.setDeployVersion}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {deployVersion.versionOptions.length > 0 ? (
                    deployVersion.versionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{option.label}</span>
                          <span className="text-xs text-muted-foreground truncate">{option.meta}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-versions" disabled>
                      No versions available for this environment
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => deployVersion.setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={deployVersion.onDeploySpecific}
                disabled={!deployVersion.deployVersion}
                className="gap-2"
              >
                <Rocket className="w-4 h-4" />
                Deploy version
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deployLog.open}
        onOpenChange={(open) => {
          deployLog.setOpen(open);
          if (!open) {
            deployLog.setSelected(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[760px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Deploy logs</DialogTitle>
          </DialogHeader>
          {deployLog.selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {renderStatusBadge(deployLog.selected.status)}
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Environment</p>
                  <p className="text-sm font-medium text-foreground">
                    {deployLog.deployEnvLabel(deployLog.selected.environment)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Commit</p>
                  <p className="text-sm font-mono text-foreground">
                    {deployLog.selected.commit
                      ? deployLog.selected.commit.substring(0, 8)
                      : '-'}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Branch</p>
                  <p className="text-sm text-foreground">{deployLog.selected.branch ?? '-'}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Triggered by</p>
                  <p className="text-sm text-foreground">{deployLog.selected.triggeredBy}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Timeline</p>
                  <p className="text-sm text-foreground">
                    {format(new Date(deployLog.selected.startedAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deployLog.selected.finishedAt
                      ? `Finished ${format(new Date(deployLog.selected.finishedAt), 'MMM dd, yyyy HH:mm')}`
                      : 'Deployment running'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs max-h-[360px] overflow-auto">
                {deployLog.selected.logs.length > 0 ? (
                  deployLog.selected.logs.map((entry, index) => (
                    <div key={`${deployLog.selected?.id}-log-${index}`} className="py-0.5 text-foreground">
                      {entry}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No logs available for this deploy yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a deploy to view logs.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createRule.open}
        onOpenChange={(open) => {
          createRule.setOpen(open);
          if (!open) {
            createRule.onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Create rule</DialogTitle>
            <DialogDescription>
              This rule applies to <span className="font-medium text-foreground">{getEnvironmentLabel(createRule.viewEnv)}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_180px_180px] gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-rule-name">Rule name</Label>
                <Input
                  id="new-rule-name"
                  value={createRule.newRuleName}
                  onChange={(event) => createRule.setNewRuleName(event.target.value)}
                  placeholder="allow-auth"
                  className="bg-muted/40 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={createRule.newRuleAction} onValueChange={(value) => createRule.setNewRuleAction(value as RulePolicyConfig['action'])}>
                  <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <div className="h-10 px-3 rounded-md border border-border bg-muted/30 flex items-center text-sm text-muted-foreground">
                  {getEnvironmentLabel(createRule.viewEnv)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Methods</p>
                <div className="flex flex-wrap gap-1.5">
                  {ruleMethods.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => createRule.toggleNewRuleMethod(method)}
                      className={cn(
                        'px-2.5 py-1.5 rounded text-xs font-mono font-medium border transition-colors',
                        createRule.newRuleMethods.includes(method)
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paths</p>
                <div className="flex gap-2">
                  <Input
                    value={createRule.newRulePathDraft}
                    onChange={(event) => createRule.setNewRulePathDraft(event.target.value)}
                    placeholder="/api/v1/*"
                    className="bg-muted/40 font-mono text-sm"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        createRule.addNewRulePath();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={createRule.addNewRulePath}>
                    Add path
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {createRule.newRulePaths.map((path) => (
                    <Badge key={path} variant="secondary" className="gap-1 font-mono normal-case">
                      {path}
                      <button type="button" onClick={() => createRule.removeNewRulePath(path)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                {createRule.newRulePaths.length === 0 && (
                  <p className="text-xs text-warning">At least one path is required.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Publication</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
                  <Checkbox
                    checked={createRule.newRulePublishTargets.internal}
                    onCheckedChange={(checked) =>
                      createRule.setNewRulePublishTargets({
                        ...createRule.newRulePublishTargets,
                        internal: Boolean(checked),
                      })
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Internal gateway</p>
                    <p className="text-xs text-muted-foreground">Expose the rule through the internal gateway.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
                  <Checkbox
                    checked={createRule.newRulePublishTargets.external}
                    onCheckedChange={(checked) =>
                      createRule.setNewRulePublishTargets({
                        ...createRule.newRulePublishTargets,
                        external: Boolean(checked),
                      })
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">External gateway</p>
                    <p className="text-xs text-muted-foreground">Publish externally through external gateways.</p>
                  </div>
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                If no target is selected, the rule will be saved as a draft.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => createRule.setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={createRule.onConfirm} className="gap-2" disabled={createRule.newRulePaths.length === 0}>
              <Plus className="w-4 h-4" />
              Create rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editRule.open}
        onOpenChange={(open) => {
          editRule.setOpen(open);
          if (!open) {
            editRule.onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit rule</DialogTitle>
            <DialogDescription>
              This rule applies to{' '}
              <span className="font-medium text-foreground">
                {getEnvironmentLabel(editRule.editingRule?.environment ?? editRule.viewEnv)}
              </span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_180px_180px] gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rule-name">Rule name</Label>
                <Input
                  id="edit-rule-name"
                  value={editRule.editRuleName}
                  onChange={(event) => editRule.setEditRuleName(event.target.value)}
                  placeholder="allow-auth"
                  className="bg-muted/40 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={editRule.editRuleAction} onValueChange={(value) => editRule.setEditRuleAction(value as RulePolicyConfig['action'])}>
                  <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <div className="h-10 px-3 rounded-md border border-border bg-muted/30 flex items-center text-sm text-muted-foreground">
                  {getEnvironmentLabel(editRule.editingRule?.environment ?? editRule.viewEnv)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Methods</p>
                <div className="flex flex-wrap gap-1.5">
                  {ruleMethods.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => editRule.toggleEditRuleMethod(method)}
                      className={cn(
                        'px-2.5 py-1.5 rounded text-xs font-mono font-medium border transition-colors',
                        editRule.editRuleMethods.includes(method)
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paths</p>
                <div className="flex gap-2">
                  <Input
                    value={editRule.editRulePathDraft}
                    onChange={(event) => editRule.setEditRulePathDraft(event.target.value)}
                    placeholder="/api/v1/*"
                    className="bg-muted/40 font-mono text-sm"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        editRule.addEditRulePath();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={editRule.addEditRulePath}>
                    Add path
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editRule.editRulePaths.map((path) => (
                    <Badge key={path} variant="secondary" className="gap-1 font-mono normal-case">
                      {path}
                      {editRule.editRulePaths.length > 1 && (
                        <button type="button" onClick={() => editRule.removeEditRulePath(path)}>
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={editRule.onOpenCopyFromEdit}>
                Copy rule
              </Button>
              <Button type="button" variant="destructive" onClick={editRule.onDeleteRuleFromEdit} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete rule
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => editRule.setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={editRule.onConfirm}>
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={copyRule.open}
        onOpenChange={(open) => {
          copyRule.setOpen(open);
          if (!open) {
            copyRule.onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Copy rule</DialogTitle>
            <DialogDescription>
              Copy <span className="font-medium text-foreground">{copyRule.copyRule?.name ?? 'Rule'}</span> from{' '}
              <span className="font-medium text-foreground">{getEnvironmentLabel(copyRule.copyRule?.environment ?? copyRule.viewEnv)}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target environments</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {copyRule.environmentOptions
                  .filter((env) => env.id !== (copyRule.copyRule?.environment ?? copyRule.viewEnv))
                  .map((env) => (
                    <label key={env.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={copyRule.copyRuleEnvs.includes(env.id)}
                        onCheckedChange={() => copyRule.toggleCopyRuleEnvironment(env.id)}
                      />
                      <span>{env.name}</span>
                    </label>
                  ))}
                {copyRule.environmentOptions.filter((env) => env.id !== (copyRule.copyRule?.environment ?? copyRule.viewEnv)).length === 0 && (
                  <span className="text-sm text-muted-foreground">No other environments available.</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => copyRule.setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={copyRule.onConfirm} disabled={copyRule.copyRuleEnvs.length === 0} className="gap-2">
              <Copy className="w-4 h-4" />
              Copy rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={publishRule.open}
        onOpenChange={(open) => {
          publishRule.setOpen(open);
          if (!open) {
            publishRule.onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Manage publication</DialogTitle>
            <DialogDescription>
              Choose where this rule should be published in{' '}
              <span className="font-medium text-foreground">{getEnvironmentLabel(publishRule.viewEnv)}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rule</span>
                <span className="font-mono text-foreground">{publishRule.publishRule?.name ?? 'Rule'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current state</span>
                <span className="text-foreground">
                  {getPublicationLabel(getGatewayTargets(publishRule.publishRule?.gateways ?? []))}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Publication targets</p>
              <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
                <Checkbox
                  checked={publishRule.publishTargets.internal}
                  onCheckedChange={(checked) =>
                    publishRule.setPublishTargets({
                      ...publishRule.publishTargets,
                      internal: Boolean(checked),
                    })
                  }
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Internal gateway</p>
                  <p className="text-xs text-muted-foreground">Expose the rule through the internal gateway.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
                <Checkbox
                  checked={publishRule.publishTargets.external}
                  onCheckedChange={(checked) =>
                    publishRule.setPublishTargets({
                      ...publishRule.publishTargets,
                      external: Boolean(checked),
                    })
                  }
                />
                <div>
                  <p className="text-sm font-medium text-foreground">External gateway</p>
                  <p className="text-xs text-muted-foreground">Publish externally through external gateways.</p>
                </div>
              </label>
              <p className="text-[11px] text-muted-foreground">Unselect all targets to unpublish the rule.</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resulting lifecycle</p>
                <p className="text-sm font-medium text-foreground">
                  {hasPublishTargets ? 'Published' : 'Draft'}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {publishSummaryLabel}
              </Badge>
            </div>

            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Attention</p>
              <p>Changes can propagate immediately or take a few minutes to be visible.</p>
              <p>Traffic may be impacted while policies are syncing.</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => publishRule.setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => publishRule.setPublishTargets({ internal: false, external: false })}
              disabled={!hasPublishTargets}
            >
              Unpublish all
            </Button>
            <Button type="button" onClick={publishRule.onConfirm} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Apply changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={deleteRule.open}
        onOpenChange={deleteRule.onOpenChange}
        title="Delete rule"
        description={
          deleteRule.selected
            ? `You are about to delete the rule "${deleteRule.selected.name}". This action cannot be undone.`
            : 'This action cannot be undone.'
        }
        confirmPhrase="delete"
        confirmLabel="Delete rule"
        onConfirm={deleteRule.onConfirm}
      />

      <ConfirmDeleteModal
        open={deleteService.open}
        onOpenChange={deleteService.setOpen}
        title="Delete service"
        description={
          deleteService.service
            ? `You are about to delete the service "${deleteService.service.name}". This action cannot be undone.`
            : 'This action cannot be undone.'
        }
        confirmPhrase="delete"
        confirmLabel="Delete service"
        onConfirm={deleteService.onConfirm}
      />

      <ConfirmDeployModal
        open={confirmDeploy.open}
        onOpenChange={confirmDeploy.setOpen}
        service={confirmDeploy.service}
        environment={confirmDeploy.viewEnv}
        version={confirmDeploy.pendingVersion ?? 'Latest'}
        onStart={confirmDeploy.onStart}
        onError={confirmDeploy.onError}
        onConfirm={confirmDeploy.onConfirm}
      />
    </>
  );
};
