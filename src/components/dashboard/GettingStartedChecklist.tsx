import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  Github,
  Package,
  Rocket,
  Server,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getDocsUrl } from '@/lib/docs-url';

type ChecklistStep = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  complete: boolean;
  href?: string;
  actionLabel?: string;
  adminOwned?: boolean;
};

interface GettingStartedChecklistProps {
  isAdmin: boolean;
  hasScmCredentials: boolean;
  hasRegistryCredentials: boolean;
  onlineWorkerCount: number;
  workerRegistrationCount: number;
  projectCount: number;
  serviceCount: number;
  successfulDeployCount: number;
  firstProjectId?: string;
  firstServiceId?: string;
}

const stepStateBadgeClass = (step: ChecklistStep, isAdmin: boolean) => {
  if (step.complete) {
    return 'border-success/30 bg-success/10 text-success';
  }
  if (step.adminOwned && !isAdmin) {
    return 'border-warning/30 bg-warning/10 text-warning';
  }
  return 'border-border bg-muted/40 text-muted-foreground';
};

export function GettingStartedChecklist({
  isAdmin,
  hasScmCredentials,
  hasRegistryCredentials,
  onlineWorkerCount,
  workerRegistrationCount,
  projectCount,
  serviceCount,
  successfulDeployCount,
  firstProjectId,
  firstServiceId,
}: GettingStartedChecklistProps) {
  const workerDescription =
    onlineWorkerCount > 0
      ? 'At least one worker is online and ready to process deploy operations.'
      : workerRegistrationCount > 0
        ? 'A worker registration exists, but no worker is online yet. Finish worker bootstrap or bring the agent online.'
        : 'At least one worker must be online before the platform can run deploy operations.';

  const newServiceHref = firstProjectId ? `/services/new?project=${firstProjectId}` : '/services/new';

  const steps: ChecklistStep[] = [
    {
      id: 'scm',
      title: 'Connect a Git provider',
      description: 'Workers need SCM credentials for repository clones, template usage, and GitOps pull requests.',
      icon: Github,
      complete: hasScmCredentials,
      href: '/settings?tab=credentials&focus=scm',
      actionLabel: 'Open SCM credentials',
      adminOwned: true,
    },
    {
      id: 'registry',
      title: 'Connect a container registry',
      description: 'Workers need registry credentials to push images and deploy from private registries.',
      icon: Package,
      complete: hasRegistryCredentials,
      href: '/settings?tab=credentials&focus=registry',
      actionLabel: 'Open registry credentials',
      adminOwned: true,
    },
    {
      id: 'workers',
      title: 'Have a worker ready',
      description: workerDescription,
      icon: Server,
      complete: onlineWorkerCount > 0,
      href: '/workers?action=register',
      actionLabel: workerRegistrationCount > 0 ? 'Open workers' : 'Register worker',
      adminOwned: true,
    },
    {
      id: 'projects',
      title: 'Create the first project',
      description: 'Projects group ownership, credentials, services, and governance defaults.',
      icon: FolderKanban,
      complete: projectCount > 0,
      href: '/projects?action=create',
      actionLabel: 'Create project',
    },
    {
      id: 'services',
      title: 'Create or adopt a service',
      description: 'Start from a template or import an existing workload from the cluster.',
      icon: Server,
      complete: serviceCount > 0,
      href: newServiceHref,
      actionLabel: 'Create service',
    },
    {
      id: 'deploy',
      title: 'Complete the first deploy',
      description: 'Run one successful deploy to validate the platform end to end.',
      icon: Rocket,
      complete: successfulDeployCount > 0,
      href: firstServiceId ? `/services/${firstServiceId}` : newServiceHref,
      actionLabel: firstServiceId ? 'Open first service' : 'Create service',
    },
  ];

  const completedSteps = steps.filter((step) => step.complete).length;
  const progress = Math.round((completedSteps / steps.length) * 100);
  const firstActionableStep = steps.find((step) => !step.complete && (!step.adminOwned || isAdmin));

  if (completedSteps === steps.length) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Getting started with Releasea</h2>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {completedSteps}/{steps.length} complete
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Finish these core steps to reach a first successful deploy. The checklist stays visible until the platform
            completes one end-to-end deployment.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {firstActionableStep ? (
            <Button asChild size="sm">
              <Link to={firstActionableStep.href ?? '/'} className="gap-2">
                {firstActionableStep.actionLabel ?? 'Continue setup'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Waiting on platform admin
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.location.assign(getDocsUrl('getting-started'))}>
            Getting Started
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Core setup progress</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const needsAdmin = step.adminOwned && !isAdmin && !step.complete;
          return (
            <div
              key={step.id}
              className={`flex h-full rounded-lg border p-4 ${
                step.complete
                  ? 'border-success/20 bg-success/5'
                  : needsAdmin
                    ? 'border-warning/20 bg-warning/5'
                    : 'border-border bg-background'
              }`}
            >
              <div className="flex h-full w-full items-start gap-3">
                <div
                  className={`mt-0.5 rounded-md p-2 ${
                    step.complete
                      ? 'bg-success/10 text-success'
                      : needsAdmin
                        ? 'bg-warning/10 text-warning'
                        : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {step.complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <Badge variant="outline" className={stepStateBadgeClass(step, isAdmin)}>
                      {step.complete ? 'Done' : needsAdmin ? 'Admin action' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {!step.complete && step.href && !needsAdmin && (
                    <Button asChild size="sm" variant="outline" className="mt-auto self-start">
                      <Link to={step.href}>{step.actionLabel ?? 'Open'}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-warning/10 p-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Recommended before onboarding more teams</p>
            <p className="text-sm text-muted-foreground">
              Add a secrets provider in Settings so managed services can resolve secret references without hardcoded
              runtime values.
            </p>
            {isAdmin ? (
              <Button asChild size="sm" variant="ghost" className="h-auto px-0 text-primary hover:bg-transparent">
                <Link to="/settings?tab=credentials">Open secret providers</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">This step requires an administrator.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
