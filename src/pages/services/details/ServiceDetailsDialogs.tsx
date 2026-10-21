import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { ConfirmDeployModal } from '@/components/modals/ConfirmDeployModal';
import {
  WorkflowDialogBody,
  WorkflowDialogContent,
  WorkflowDialogFooter,
  WorkflowDialogHeader,
  WorkflowDialogSection,
} from '@/components/modals/WorkflowDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { getEnvironmentLabel } from '@/lib/environments';
import { summarizeDeployPolicyViolations } from '@/lib/deploy-policy';
import { cn } from '@/lib/utils';
import type { Deploy, ManagedRule, RulePolicyConfig, Service } from '@/types/releasea';
import type { RulePublishPolicyPreflight } from '@/types/governance';
import { format } from 'date-fns';
import { CheckCircle, Copy, Plus, Rocket, Route, Trash2 } from 'lucide-react';
import {
  getGatewayTargets,
  getPublicationLabel,
} from './constants';
import type { PublicationTargets, RuleRow } from './types';
import { RuleForm } from './RuleForm';
import type { EdgePolicyDraft } from './edge-policy';

const renderStatusBadge = (status: Deploy['status']) => (
  <StatusBadge status={status} className="normal-case" />
);

function RuleDialogHeading({
  title,
  description,
  environment,
}: {
  title: string;
  description: string;
  environment: string;
}) {
  return (
    <WorkflowDialogHeader
      title={title}
      description={description}
      icon={<Route className="h-4 w-4" />}
      meta={<Badge variant="outline" className="font-normal normal-case">{environment}</Badge>}
    />
  );
}

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
    newRuleAuthMode: NonNullable<RulePolicyConfig['authMode']>;
    setNewRuleAuthMode: (value: NonNullable<RulePolicyConfig['authMode']>) => void;
    newRuleJWTIssuer: string;
    setNewRuleJWTIssuer: (value: string) => void;
    newRuleJWKSUri: string;
    setNewRuleJWKSUri: (value: string) => void;
    newRuleAudiences: string;
    setNewRuleAudiences: (value: string) => void;
    newEdge: EdgePolicyDraft;
    setNewEdge: (value: EdgePolicyDraft) => void;
    newRuleMethods: string[];
    toggleNewRuleMethod: (method: string) => void;
    newRulePathDraft: string;
    setNewRulePathDraft: (value: string) => void;
    addNewRulePath: () => void;
    newRulePaths: string[];
    removeNewRulePath: (path: string) => void;
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
    editRuleAuthMode: NonNullable<RulePolicyConfig['authMode']>;
    setEditRuleAuthMode: (value: NonNullable<RulePolicyConfig['authMode']>) => void;
    editRuleJWTIssuer: string;
    setEditRuleJWTIssuer: (value: string) => void;
    editRuleJWKSUri: string;
    setEditRuleJWKSUri: (value: string) => void;
    editRuleAudiences: string;
    setEditRuleAudiences: (value: string) => void;
    editEdge: EdgePolicyDraft;
    setEditEdge: (value: EdgePolicyDraft) => void;
    editRuleMethods: string[];
    toggleEditRuleMethod: (method: string) => void;
    editRulePathDraft: string;
    setEditRulePathDraft: (value: string) => void;
    addEditRulePath: () => void;
    editRulePaths: string[];
    removeEditRulePath: (path: string) => void;
    onDeleteRuleFromEdit: () => void;
    onConfirm: () => void;
  };
  publishRule: {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose: () => void;
    rule: ManagedRule | null;
    viewEnv: string;
    targets: PublicationTargets;
    setTargets: (value: PublicationTargets) => void;
    preflight: RulePublishPolicyPreflight | null;
    preflightLoading: boolean;
    onConfirm: () => void;
  };
  promoteRule: {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose: () => void;
    rule: ManagedRule | null;
    viewEnv: string;
    environmentOptions: { id: string; name: string }[];
    selected: string[];
    toggle: (envId: string) => void;
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
    promoteFrom?: string | null;
    promoteFromLabel?: string;
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
  publishRule,
  promoteRule,
  deleteRule,
  deleteService,
  confirmDeploy,
}: ServiceDetailsDialogsProps) => {
  const hasPublishTargets = publishRule.targets.internal || publishRule.targets.external;
  const publishSummaryLabel = getPublicationLabel(publishRule.targets);
  const publishPolicyViolations = publishRule.preflight?.violations ?? [];
  const publishPolicyDryRun = publishRule.preflight?.dryRun === true;
  const publishBlockedByPolicy = publishPolicyViolations.length > 0 && !publishPolicyDryRun;

  return (
    <>
      <Dialog open={deployVersion.open} onOpenChange={deployVersion.setOpen}>
        <DialogContent className="sm:max-w-[520px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Deploy specific version</DialogTitle>
            <DialogDescription>
              Choose a known version and review the target environment before starting the deployment.
            </DialogDescription>
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
            <DialogDescription>
              Review the deployment timeline and output captured for this operation.
            </DialogDescription>
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
                    <div
                      key={`${deployLog.selected?.id}-log-${index}`}
                      className="py-0.5 text-foreground whitespace-pre-wrap break-all"
                    >
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
        <WorkflowDialogContent size="xl" className="h-[min(700px,calc(100vh-2rem))]">
          <RuleDialogHeading
            title="Create rule"
            description="Define which requests match, how callers authenticate, and which gateway controls apply."
            environment={getEnvironmentLabel(createRule.viewEnv)}
          />
          <RuleForm
            tabKey="create-rule"
            idPrefix="new-rule"
            name={createRule.newRuleName}
            onNameChange={createRule.setNewRuleName}
            action={createRule.newRuleAction}
            onActionChange={createRule.setNewRuleAction}
            authMode={createRule.newRuleAuthMode}
            onAuthModeChange={createRule.setNewRuleAuthMode}
            jwtIssuer={createRule.newRuleJWTIssuer}
            onJwtIssuerChange={createRule.setNewRuleJWTIssuer}
            jwksUri={createRule.newRuleJWKSUri}
            onJwksUriChange={createRule.setNewRuleJWKSUri}
            audiences={createRule.newRuleAudiences}
            onAudiencesChange={createRule.setNewRuleAudiences}
            edge={createRule.newEdge}
            onEdgeChange={createRule.setNewEdge}
            methods={createRule.newRuleMethods}
            onToggleMethod={createRule.toggleNewRuleMethod}
            pathDraft={createRule.newRulePathDraft}
            onPathDraftChange={createRule.setNewRulePathDraft}
            onAddPath={createRule.addNewRulePath}
            paths={createRule.newRulePaths}
            onRemovePath={createRule.removeNewRulePath}
          />
          <WorkflowDialogFooter>
            <Button type="button" variant="ghost" onClick={() => createRule.setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={createRule.onConfirm} className="gap-2" disabled={createRule.newRulePaths.length === 0}>
              <Plus className="w-4 h-4" />
              Create rule
            </Button>
          </WorkflowDialogFooter>
        </WorkflowDialogContent>
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
        <WorkflowDialogContent size="xl" className="h-[min(700px,calc(100vh-2rem))]">
          <RuleDialogHeading
            title="Edit rule"
            description="Update request matching, caller access, and gateway behavior without changing publication targets."
            environment={getEnvironmentLabel(editRule.editingRule?.environment ?? editRule.viewEnv)}
          />
          <RuleForm
            tabKey={editRule.editingRule?.id ?? 'edit-rule'}
            idPrefix="edit-rule"
            name={editRule.editRuleName}
            onNameChange={editRule.setEditRuleName}
            action={editRule.editRuleAction}
            onActionChange={editRule.setEditRuleAction}
            authMode={editRule.editRuleAuthMode}
            onAuthModeChange={editRule.setEditRuleAuthMode}
            jwtIssuer={editRule.editRuleJWTIssuer}
            onJwtIssuerChange={editRule.setEditRuleJWTIssuer}
            jwksUri={editRule.editRuleJWKSUri}
            onJwksUriChange={editRule.setEditRuleJWKSUri}
            audiences={editRule.editRuleAudiences}
            onAudiencesChange={editRule.setEditRuleAudiences}
            edge={editRule.editEdge}
            onEdgeChange={editRule.setEditEdge}
            methods={editRule.editRuleMethods}
            onToggleMethod={editRule.toggleEditRuleMethod}
            pathDraft={editRule.editRulePathDraft}
            onPathDraftChange={editRule.setEditRulePathDraft}
            onAddPath={editRule.addEditRulePath}
            paths={editRule.editRulePaths}
            onRemovePath={editRule.removeEditRulePath}
          />
          <WorkflowDialogFooter split>
            <Button type="button" variant="destructive" onClick={editRule.onDeleteRuleFromEdit} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete rule
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => editRule.setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={editRule.onConfirm} disabled={editRule.editRulePaths.length === 0}>
                Save changes
              </Button>
            </div>
          </WorkflowDialogFooter>
        </WorkflowDialogContent>
      </Dialog>

      <Dialog
        open={publishRule.open}
        onOpenChange={(open) => {
          publishRule.setOpen(open);
          if (!open) publishRule.onClose();
        }}
      >
        <WorkflowDialogContent size="xl" className="h-[min(700px,calc(100vh-2rem))]">
          <RuleDialogHeading
            title="Manage publication"
            description="Choose where this saved rule receives traffic and review governance checks before applying it."
            environment={getEnvironmentLabel(publishRule.rule?.environment ?? publishRule.viewEnv)}
          />
          <WorkflowDialogBody className="grid content-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <WorkflowDialogSection
              title="Publication targets"
              description="Internal and external gateways can be managed independently."
            >
              <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Current</p>
                  <p className="text-sm text-foreground">
                    {getPublicationLabel(getGatewayTargets(publishRule.rule?.gateways ?? []))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{hasPublishTargets ? 'Published' : 'Draft'}</span>
                  <Badge variant="outline" className="text-xs">{publishSummaryLabel}</Badge>
                </div>
              </div>
              <label className="flex items-center gap-3 border-b border-border/70 px-3 py-3">
                <Checkbox
                  checked={publishRule.targets.internal}
                  onCheckedChange={(checked) =>
                    publishRule.setTargets({ ...publishRule.targets, internal: Boolean(checked) })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">Internal gateway</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Private traffic for this environment.</span>
                </span>
              </label>
              <label className="flex items-center gap-3 border-b border-border/70 px-3 py-3">
                <Checkbox
                  checked={publishRule.targets.external}
                  onCheckedChange={(checked) =>
                    publishRule.setTargets({ ...publishRule.targets, external: Boolean(checked) })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">External gateway</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Public traffic for this environment.</span>
                </span>
              </label>
              <div
                className={cn(
                  'px-3 py-2.5 text-sm',
                  publishBlockedByPolicy
                    ? 'bg-destructive/10 text-foreground'
                    : publishPolicyViolations.length > 0
                      ? 'bg-warning/10 text-foreground'
                      : 'text-foreground',
                )}
              >
                <p className="font-medium">
                  {publishRule.preflightLoading
                    ? 'Checking publish policy'
                    : publishBlockedByPolicy
                      ? 'Publication blocked by policy'
                      : publishPolicyViolations.length > 0
                        ? 'Publication warnings in dry-run mode'
                        : 'No policy blockers for this publication'}
                </p>
                {publishPolicyViolations.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {publishPolicyDryRun
                      ? 'These warnings are audited and do not block publication while dry-run mode stays enabled.'
                      : summarizeDeployPolicyViolations(publishPolicyViolations)}
                  </p>
                )}
              </div>
              </div>
            </WorkflowDialogSection>
            <WorkflowDialogSection title="What happens next" description="Publication changes routing only. The rule remains saved even when every target is cleared.">
              <dl className="space-y-3 text-sm">
                <div><dt className="font-medium text-foreground">Internal</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Routes private traffic through the environment's internal host.</dd></div>
                <div><dt className="font-medium text-foreground">External</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Routes public traffic through the environment's external host.</dd></div>
              </dl>
            </WorkflowDialogSection>
          </WorkflowDialogBody>
          <WorkflowDialogFooter>
            <Button type="button" variant="ghost" onClick={() => publishRule.setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => publishRule.setTargets({ internal: false, external: false })}
              disabled={!hasPublishTargets || publishRule.preflightLoading}
            >
              Unpublish all
            </Button>
            <Button
              type="button"
              onClick={publishRule.onConfirm}
              className="gap-2"
              disabled={publishRule.preflightLoading || publishBlockedByPolicy}
            >
              <CheckCircle className="w-4 h-4" />
              Apply publication
            </Button>
          </WorkflowDialogFooter>
        </WorkflowDialogContent>
      </Dialog>

      <Dialog
        open={promoteRule.open}
        onOpenChange={(open) => {
          promoteRule.setOpen(open);
          if (!open) promoteRule.onClose();
        }}
      >
        <WorkflowDialogContent size="xl" className="h-[min(700px,calc(100vh-2rem))]">
          <RuleDialogHeading
            title="Promote rule"
            description="Copy the rule configuration into one or more environments while preserving each destination's identity."
            environment={getEnvironmentLabel(promoteRule.rule?.environment ?? promoteRule.viewEnv)}
          />
          <WorkflowDialogBody className="grid content-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <WorkflowDialogSection title="Destination environments" description="Select every environment that should receive a new revision.">
              <div className="overflow-hidden rounded-lg border border-border/70">
                {promoteRule.environmentOptions
                  .filter((env) => env.id !== (promoteRule.rule?.environment ?? promoteRule.viewEnv))
                  .map((env, index, list) => (
                    <label
                      key={env.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3',
                        index < list.length - 1 && 'border-b border-border/70',
                      )}
                    >
                      <Checkbox
                        checked={promoteRule.selected.includes(env.id)}
                        onCheckedChange={() => promoteRule.toggle(env.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{env.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Next revision of {promoteRule.rule?.name ?? 'this rule'}, on its own host.
                        </span>
                      </span>
                    </label>
                  ))}
                {promoteRule.environmentOptions.filter((env) => env.id !== (promoteRule.rule?.environment ?? promoteRule.viewEnv)).length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No other environments available.</p>
                )}
              </div>
            </WorkflowDialogSection>
            <WorkflowDialogSection title="Promotion scope" description="Promotion creates a new rule revision; it does not deploy an application image.">
              <dl className="space-y-3 text-sm">
                <div><dt className="font-medium text-foreground">Copied</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Paths, methods, access, and edge policy.</dd></div>
                <div><dt className="font-medium text-foreground">Preserved</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Host, namespace, publication state, and running image.</dd></div>
              </dl>
            </WorkflowDialogSection>
          </WorkflowDialogBody>
          <WorkflowDialogFooter>
            <Button type="button" variant="ghost" onClick={() => promoteRule.setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={promoteRule.onConfirm} disabled={promoteRule.selected.length === 0} className="gap-2">
              <Copy className="w-4 h-4" />
              Promote rule
            </Button>
          </WorkflowDialogFooter>
        </WorkflowDialogContent>
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
        promoteFrom={confirmDeploy.promoteFrom}
        promoteFromLabel={confirmDeploy.promoteFromLabel}
        onStart={confirmDeploy.onStart}
        onError={confirmDeploy.onError}
        onConfirm={confirmDeploy.onConfirm}
      />
    </>
  );
};
