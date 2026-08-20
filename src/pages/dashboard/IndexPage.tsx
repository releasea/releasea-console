import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Server, Cpu, Rocket, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { FirstDeployGuide } from '@/components/dashboard/FirstDeployGuide';
import { GettingStartedChecklist } from '@/components/dashboard/GettingStartedChecklist';
import { OperatorHealthReport } from '@/components/dashboard/OperatorHealthReport';
import { ProviderReadinessChecks } from '@/components/dashboard/ProviderReadinessChecks';
import { ServicesList } from '@/components/dashboard/ServicesList';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchDeploys,
  fetchControlPlaneMetrics,
  fetchProviderHealth,
  fetchProviderStatus,
  fetchProjects,
  fetchRegistryCredentials,
  fetchScmCredentials,
  fetchServices,
  fetchWorkerPools,
  fetchWorkerRegistrations,
  fetchWorkers,
} from '@/lib/data';
import { isFailedDeployStatus, isSuccessfulDeployStatus } from '@/lib/deploy-status';
import { buildOperatorHealthReport } from '@/lib/operator-health';
import type {
  Deploy,
  ControlPlaneMetrics,
  Project,
  ProviderHealthCatalog,
  ProviderStatusCatalog,
  RegistryCredential,
  ScmCredential,
  Service,
  Worker,
  WorkerPool,
  WorkerRegistration,
} from '@/types/releasea';

const Dashboard = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('admin');
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerPools, setWorkerPools] = useState<WorkerPool[]>([]);
  const [workerRegistrations, setWorkerRegistrations] = useState<WorkerRegistration[]>([]);
  const [scmCredentials, setScmCredentials] = useState<ScmCredential[]>([]);
  const [registryCredentials, setRegistryCredentials] = useState<RegistryCredential[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusCatalog | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthCatalog | null>(null);
  const [controlPlaneMetrics, setControlPlaneMetrics] = useState<ControlPlaneMetrics | null>(null);
  const [isRunningProviderHealth, setIsRunningProviderHealth] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [
        projectsData,
        servicesData,
        deploysData,
        workersData,
        workerPoolsData,
        workerRegistrationsData,
        scmCredentialsData,
        registryCredentialsData,
        providerStatusData,
        providerHealthData,
        controlPlaneMetricsData,
      ] = await Promise.all([
        fetchProjects(),
        fetchServices(),
        fetchDeploys(),
        fetchWorkers(),
        fetchWorkerPools(),
        fetchWorkerRegistrations(),
        fetchScmCredentials(),
        fetchRegistryCredentials(),
        fetchProviderStatus(),
        isAdmin ? fetchProviderHealth() : Promise.resolve(null),
        isAdmin ? fetchControlPlaneMetrics() : Promise.resolve(null),
      ]);
      if (!active) return;
      setProjects(projectsData);
      setServices(servicesData);
      setDeploys(deploysData);
      setWorkers(workersData);
      setWorkerPools(workerPoolsData);
      setWorkerRegistrations(workerRegistrationsData);
      setScmCredentials(scmCredentialsData);
      setRegistryCredentials(registryCredentialsData);
      setProviderStatus(providerStatusData);
      setProviderHealth(providerHealthData);
      setControlPlaneMetrics(controlPlaneMetricsData);
    };
    load();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const handleRunProviderHealthChecks = useCallback(async () => {
    setIsRunningProviderHealth(true);
    const health = await fetchProviderHealth();
    setProviderHealth(health);
    setIsRunningProviderHealth(false);
  }, []);

  const runningServices = services.filter((s) => s.status === 'running').length;
  const onlineWorkers = workers.filter((w) => w.status === 'online' || w.status === 'busy').length;
  const successDeploys = deploys.filter((deploy) => isSuccessfulDeployStatus(deploy.status)).length;
  const failedDeploys = deploys.filter((deploy) => isFailedDeployStatus(deploy.status)).length;
  const totalDeploys = successDeploys + failedDeploys;
  const deploySuccessRate = totalDeploys === 0 ? 0 : Math.round((successDeploys / totalDeploys) * 100);
  const teamsCount = new Set(projects.map((project) => project.teamId)).size;
  const environmentsCount = new Set(workers.map((worker) => worker.environment)).size;
  const actionableWorkers = workers.filter((worker) => worker.status === 'online' || worker.status === 'busy').length;
  const microservicesCount = services.filter((service) => service.type === 'microservice').length;
  const sitesCount = services.filter((service) => service.type === 'static-site').length;
  const serviceBreakdown = `${microservicesCount} ${microservicesCount === 1 ? 'microservice' : 'microservices'}, ${sitesCount} ${sitesCount === 1 ? 'site' : 'sites'}`;
  const showGettingStartedChecklist = successDeploys === 0;
  const primaryProjectId = projects[0]?.id;
  const primaryServiceId = services[0]?.id;
  const newServiceHref = primaryProjectId ? `/services/new?project=${primaryProjectId}` : '/services/new';
  const emptyServiceActionHref = projects.length > 0 ? newServiceHref : '/projects?action=create';
  const emptyServiceActionLabel = projects.length > 0 ? 'New Service' : 'Create Project';
  const operatorHealthReport = buildOperatorHealthReport({
    providerHealth,
    controlPlaneMetrics,
    workerPools,
    deploys,
  });

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-screen-2xl space-y-6">
        <ListPageHeader
          title="Dashboard"
          description="Monitor service health, deploys, and platform readiness."
          docsSlug="overview"
          actions={(
            <Button onClick={() => navigate(emptyServiceActionHref)} className="gap-2">
              <Plus className="h-4 w-4" />
              {emptyServiceActionLabel}
            </Button>
          )}
        />

        {showGettingStartedChecklist ? (
          <div className="space-y-6">
            <GettingStartedChecklist
              isAdmin={isAdmin}
              hasScmCredentials={scmCredentials.length > 0}
              hasRegistryCredentials={registryCredentials.length > 0}
              onlineWorkerCount={actionableWorkers}
              workerRegistrationCount={workerRegistrations.length}
              projectCount={projects.length}
              serviceCount={services.length}
              successfulDeployCount={successDeploys}
              firstProjectId={primaryProjectId}
              firstServiceId={primaryServiceId}
            />

            <ProviderReadinessChecks
              isAdmin={isAdmin}
              scm={providerStatus?.scm}
              registry={providerStatus?.registry}
              secrets={providerStatus?.secrets}
              health={
                providerHealth
                  ? {
                      scm: providerHealth.scm,
                      registry: providerHealth.registry,
                      secrets: providerHealth.secrets,
                    }
                  : undefined
              }
              isRunningHealthChecks={isRunningProviderHealth}
              onRunHealthChecks={() => void handleRunProviderHealthChecks()}
            />

            <FirstDeployGuide
              isAdmin={isAdmin}
              hasScmCredentials={scmCredentials.length > 0}
              hasRegistryCredentials={registryCredentials.length > 0}
              hasOnlineWorker={actionableWorkers > 0}
              projectCount={projects.length}
              serviceCount={services.length}
              successfulDeployCount={successDeploys}
              firstProjectId={primaryProjectId}
              firstServiceId={primaryServiceId}
            />
          </div>
        ) : null}

        {isAdmin && !showGettingStartedChecklist ? (
          <OperatorHealthReport report={operatorHealthReport} />
        ) : null}

        {/* Operational summary */}
        <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="operational-summary-heading">
          <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="operational-summary-heading" className="text-sm font-semibold text-foreground">
                Operational summary
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Current platform capacity and delivery health.</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">Current snapshot</span>
          </div>

          <div className="grid auto-rows-fr gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="flex h-full min-h-[148px] flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-border/80">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/10 p-2 text-primary ring-1 ring-primary/15">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Projects</span>
              </div>
              <div className="mt-auto pt-4">
                <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{projects.length}</p>
                <p className="mt-1 text-sm font-medium text-foreground">Active projects</p>
                <p className="mt-1 text-xs text-muted-foreground">Across {teamsCount} {teamsCount === 1 ? 'team' : 'teams'}</p>
              </div>
            </article>

            <article className="flex h-full min-h-[148px] flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-border/80">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-info/10 p-2 text-info ring-1 ring-info/15">
                  <Server className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Services</span>
              </div>
              <div className="mt-auto pt-4">
                <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                  {runningServices}/{services.length}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">Running services</p>
                <p className="mt-1 text-xs text-muted-foreground">{serviceBreakdown}</p>
              </div>
            </article>

            <article className="flex h-full min-h-[148px] flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-border/80">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-warning/10 p-2 text-warning ring-1 ring-warning/15">
                  <Cpu className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Workers</span>
              </div>
              <div className="mt-auto pt-4">
                <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                  {onlineWorkers}/{workers.length}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">Workers online</p>
                <p className="mt-1 text-xs text-muted-foreground">Across {environmentsCount} {environmentsCount === 1 ? 'environment' : 'environments'}</p>
              </div>
            </article>

            <article className="flex h-full min-h-[148px] flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-border/80">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-success/10 p-2 text-success ring-1 ring-success/15">
                  <Rocket className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Deploys</span>
              </div>
              {totalDeploys === 0 ? (
                <div className="mt-auto pt-4">
                  <p className="text-3xl font-semibold tracking-tight text-muted-foreground tabular-nums">—</p>
                  <p className="mt-1 text-sm font-medium text-foreground">No deploy history yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Complete the first deploy to measure reliability.</p>
                </div>
              ) : (
                <div className="mt-auto pt-4">
                  <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                    {deploySuccessRate}%
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">Deploy reliability</p>
                  <Progress value={deploySuccessRate} className="mt-3 h-1.5" />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{successDeploys} success</span>
                    <span>{failedDeploys} failed</span>
                  </div>
                </div>
              )}
            </article>
          </div>
        </section>

        {/* Main Content */}
        <div className="space-y-6">
          {services.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/60 p-8">
              <EmptyState
                icon={<Server className="h-5 w-5 text-muted-foreground" />}
                title="No services yet"
                description={
                  projects.length > 0
                    ? 'Create a new service or adopt an existing workload from the cluster to start using Releasea.'
                    : 'Create the first project, then add a service or import an existing workload from the cluster.'
                }
                actionLabel={emptyServiceActionLabel}
                onAction={() => navigate(emptyServiceActionHref)}
                tone="muted"
              />
            </div>
          ) : (
            <ServicesList
              services={services}
              deploys={deploys}
              projects={projects}
              showHeader
              title="Recent services"
              meta={`${services.length} total`}
            />
          )}
          {/* Deploys and Workers tables removed as requested */}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
