import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleDashed, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveFirstDeployGuide } from '@/lib/onboarding';

interface FirstDeployGuideProps {
  isAdmin: boolean;
  hasScmCredentials: boolean;
  hasRegistryCredentials: boolean;
  hasOnlineWorker: boolean;
  projectCount: number;
  serviceCount: number;
  successfulDeployCount: number;
  firstProjectId?: string;
  firstServiceId?: string;
}

export function FirstDeployGuide({
  isAdmin,
  hasScmCredentials,
  hasRegistryCredentials,
  hasOnlineWorker,
  projectCount,
  serviceCount,
  successfulDeployCount,
  firstProjectId,
  firstServiceId,
}: FirstDeployGuideProps) {
  const guide = resolveFirstDeployGuide({
    isAdmin,
    hasScmCredentials,
    hasRegistryCredentials,
    hasOnlineWorker,
    projectCount,
    serviceCount,
    successfulDeployCount,
    firstProjectId,
    firstServiceId,
  });

  if (successfulDeployCount > 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">First deploy guide</h2>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Guided flow
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Releasea recommends the next action based on the platform state, existing projects, and current services.
          </p>
        </div>

        {guide.ctaHref ? (
          <Button asChild size="sm" className="gap-2">
            <Link to={guide.ctaHref}>
              {guide.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            {guide.ctaLabel}
          </Button>
        )}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        {guide.steps.map((step, index) => {
          const isCurrent = step.id === guide.currentStep.id;
          return (
            <div
              key={step.id}
              className={`flex h-full rounded-lg border p-4 ${
                step.complete
                  ? 'border-success/20 bg-success/5'
                  : isCurrent
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-background'
              }`}
            >
              <div className="flex h-full w-full items-start gap-3">
                <div
                  className={`mt-0.5 rounded-md p-2 ${
                    step.complete
                      ? 'bg-success/10 text-success'
                      : isCurrent
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {step.complete ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">
                      Step {index + 1}
                    </Badge>
                    {isCurrent && !step.complete && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        Next
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {guide.blockedByAdmin && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-warning/10 p-2 text-warning">
              <Lock className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Waiting on platform configuration</p>
              <p className="text-sm text-muted-foreground">
                An administrator still needs to finish SCM, registry, or worker setup before the guided first deploy
                flow can continue.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
