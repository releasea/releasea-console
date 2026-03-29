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
import { getDocsUrl } from '@/lib/docs-url';
import { buildOperatorHealthReport } from '@/lib/operator-health';
import type {
  Deploy,
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
  const serviceBreakdown = `${microservicesCount} microservices, ${sitesCount} ${sitesCount === 1 ? 'site' : 'sites'}`;
  const showGettingStartedChecklist = successDeploys === 0;
  const primaryProjectId = projects[0]?.id;
  const primaryServiceId = services[0]?.id;
  const newServiceHref = primaryProjectId ? `/services/new?project=${primaryProjectId}` : '/services/new';
  const emptyServiceActionHref = projects.length > 0 ? newServiceHref : '/projects?action=create';
  const emptyServiceActionLabel = projects.length > 0 ? 'New Service' : 'Create Project';
  const operatorHealthReport = buildOperatorHealthReport({
    providerHealth,
    workerPools,
    deploys,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <ListPageHeader
          title="Dashboard"
          description="Real-time overview of services and operations"
        />

        {/* Banner */}
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
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">Create a production-ready service</h2>
                <p className="text-sm text-muted-foreground">
                  Standardized provisioning, safe deploys, and observability built in.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(newServiceHref)}>
                  <Plus className="h-4 w-4" />
                  New Service
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.location.assign(getDocsUrl())}>
                  Docs
                </Button>
              </div>
            </div>
          </div>
        )}

        {isAdmin && !showGettingStartedChecklist ? (
          <OperatorHealthReport report={operatorHealthReport} />
        ) : null}

        {/* Operational summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <h2 className="text-sm font-semibold text-foreground">Operational summary</h2>
              <span className="text-xs text-muted-foreground">Updated now</span>
            </div>
            <div className="divide-y divide-border/50">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted/60 p-2 ring-1 ring-border/60">
                    <FolderKanban className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Active projects</p>
                    <p className="text-xs text-muted-foreground">Across {teamsCount} teams</p>
                  </div>
                </div>
                <div className="text-right min-w-[72px]">
                  <div className="text-xl font-semibold text-foreground tabular-nums">{projects.length}</div>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted/60 p-2 ring-1 ring-border/60">
                    <Server className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Running services</p>
                    <p className="text-xs text-muted-foreground">{serviceBreakdown}</p>
                  </div>
                </div>
                <div className="text-right min-w-[72px]">
                  <div className="text-xl font-semibold text-foreground tabular-nums">
                    {runningServices}/{services.length}
                  </div>
                  <span className="text-xs text-success">+12% this week</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted/60 p-2 ring-1 ring-border/60">
                    <Cpu className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Workers online</p>
                    <p className="text-xs text-muted-foreground">Across {environmentsCount} environments</p>
                  </div>
                </div>
                <div className="text-right min-w-[72px]">
                  <div className="text-xl font-semibold text-foreground tabular-nums">
                    {onlineWorkers}/{workers.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <h2 className="text-sm font-semibold text-foreground">Deploy reliability</h2>
              <Rocket className="h-4 w-4 text-success" />
            </div>
            <div className="px-4 py-4">
              {totalDeploys === 0 ? (
                <EmptyState
                  icon={<Rocket className="h-5 w-5 text-muted-foreground" />}
                  title="No deploy history yet"
                  description="Complete the first deploy to populate reliability metrics and release intelligence."
                  compact
                  tone="muted"
                />
              ) : (
                <>
                  <div className="text-3xl font-semibold text-foreground tabular-nums">{deploySuccessRate}%</div>
                  <p className="mt-1 text-xs text-muted-foreground">Success rate over recent runs</p>
                  <Progress value={deploySuccessRate} className="mt-4 h-2" />
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{successDeploys} success</span>
                    <span>{failedDeploys} failed</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

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
