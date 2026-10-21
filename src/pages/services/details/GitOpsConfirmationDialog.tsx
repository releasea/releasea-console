import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, GitPullRequest, Info } from 'lucide-react';
import {
  WorkflowDialogBody,
  WorkflowDialogContent,
  WorkflowDialogFooter,
  WorkflowDialogHeader,
  WorkflowDialogSteps,
} from '@/components/modals/WorkflowDialog';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type GitOpsAction = 'releasea' | 'argocd' | 'flux';

const actionCopy: Record<GitOpsAction, { title: string; description: string; effect: string; confirm: string }> = {
  releasea: {
    title: 'Write the desired state',
    description: 'Opens a pull request with one file: .releasea/gitops/<service>.desired-state.yaml. Use this when your pipeline already reads that file.',
    effect: 'The running service stays as it is. Merge the pull request before any reconciler applies the new desired state.',
    confirm: 'Create pull request',
  },
  argocd: {
    title: 'Start with Argo CD',
    description: 'Opens a pull request that adds the desired-state file, a Kustomize package, and an Argo CD Application. Argo CD will sync that package as a ConfigMap.',
    effect: 'Releasea keeps deploying the workload. Argo CD only reconciles the committed desired-state package after the pull request is merged.',
    confirm: 'Create Argo CD pull request',
  },
  flux: {
    title: 'Start with Flux',
    description: 'Opens a pull request that adds the desired-state file, a Kustomize package, a Flux GitRepository, and a Flux Kustomization.',
    effect: 'Releasea keeps deploying the workload. Flux only reconciles the committed desired-state package after the pull request is merged.',
    confirm: 'Create Flux pull request',
  },
};

type GitOpsConfirmationDialogProps = {
  action: GitOpsAction | null;
  serviceName: string;
  repository: string;
  branch: string;
  environment: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: GitOpsAction) => void;
};

export function GitOpsConfirmationDialog({
  action,
  serviceName,
  repository,
  branch,
  environment,
  busy,
  onOpenChange,
  onConfirm,
}: GitOpsConfirmationDialogProps) {
  const [step, setStep] = useState<'provider' | 'review'>('provider');
  const [selectedAction, setSelectedAction] = useState<GitOpsAction>('releasea');
  const copy = actionCopy[selectedAction];

  useEffect(() => {
    if (action) {
      setSelectedAction(action);
      setStep('provider');
    }
  }, [action]);

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <WorkflowDialogContent size="md">
        <WorkflowDialogHeader
          title="GitOps delivery"
          description="Create a pull request in the service repository and choose which controller will reconcile it after merge. The running service is not changed now."
          icon={<GitPullRequest className="h-4 w-4" />}
        />

        <WorkflowDialogBody className="space-y-5">
          <WorkflowDialogSteps steps={['Delivery model', 'Review & create']} activeStep={step === 'provider' ? 0 : 1} />

          {step === 'provider' ? (
            <div className="grid gap-3">
              {(Object.keys(actionCopy) as GitOpsAction[]).map((candidate) => {
                const candidateCopy = actionCopy[candidate];
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setSelectedAction(candidate)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-colors',
                      selectedAction === candidate
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-card hover:border-border/90 hover:bg-muted/20',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <GitPullRequest className={cn('mt-0.5 h-4 w-4 shrink-0', selectedAction === candidate ? 'text-primary' : 'text-muted-foreground')} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{candidateCopy.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{candidateCopy.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/25 p-3 text-sm">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-medium text-foreground">{copy.title}</dd>
                <dt className="text-muted-foreground">Service</dt>
                <dd className="truncate font-medium text-foreground">{serviceName}</dd>
                <dt className="text-muted-foreground">Environment</dt>
                <dd className="font-medium text-foreground">{environment}</dd>
                <dt className="text-muted-foreground">Repository</dt>
                <dd className="truncate font-mono text-xs text-foreground" title={repository}>{repository}</dd>
                <dt className="text-muted-foreground">Base branch</dt>
                <dd className="font-mono text-xs text-foreground">{branch}</dd>
              </dl>

              <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="leading-5 text-muted-foreground">{copy.effect}</p>
              </div>
            </>
          )}
        </WorkflowDialogBody>

        <WorkflowDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {step === 'review' && (
            <Button type="button" variant="ghost" className="gap-2" onClick={() => setStep('provider')} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {step === 'provider' ? (
            <Button type="button" className="gap-2" onClick={() => setStep('review')}>
              Review change
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" className="gap-2" onClick={() => onConfirm(selectedAction)} disabled={busy} aria-busy={busy}>
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ExternalLink className="h-4 w-4" />}
              {busy ? 'Creating pull request...' : copy.confirm}
            </Button>
          )}
        </WorkflowDialogFooter>
      </WorkflowDialogContent>
    </Dialog>
  );
}
