import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, GitPullRequest, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type GitOpsAction = 'releasea' | 'argocd' | 'flux';

const actionCopy: Record<GitOpsAction, { title: string; description: string; effect: string; confirm: string }> = {
  releasea: {
    title: 'Create a GitOps pull request',
    description: 'Releasea will write this service’s desired state to the configured application repository.',
    effect: 'The running service is not changed immediately. After the pull request is reviewed and merged, your delivery process can apply the new desired state.',
    confirm: 'Create PR and open',
  },
  argocd: {
    title: 'Create an Argo CD starter pull request',
    description: 'Releasea will add the repository structure required to start managing this service with Argo CD.',
    effect: 'The running service remains unchanged until the pull request is merged and Argo CD reconciles the committed configuration.',
    confirm: 'Create Argo CD PR',
  },
  flux: {
    title: 'Create a Flux starter pull request',
    description: 'Releasea will add the repository structure required to start managing this service with Flux.',
    effect: 'The running service remains unchanged until the pull request is merged and Flux reconciles the committed configuration.',
    confirm: 'Create Flux PR',
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitPullRequest className="h-5 w-5" />
          </div>
          <DialogTitle>Configure GitOps delivery</DialogTitle>
          <DialogDescription>
            Choose who will reconcile the desired state, then review the repository change before creating the pull request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={cn('rounded-md border px-3 py-2', step === 'provider' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground')}>1 · Delivery model</div>
            <div className={cn('rounded-md border px-3 py-2', step === 'review' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground')}>2 · Review & create</div>
          </div>

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
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
