import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderKanban, Rocket, Plus, Settings, Server, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBackLink } from '@/components/layout/PageBackLink';
import { QuickStatsGrid } from '@/components/layout/QuickStatsGrid';
import { TabsWrapper, TabItem } from '@/components/layout/TabsWrapper';
import { SettingsSection, SettingsField, SettingsGrid } from '@/components/layout/SettingsSection';
import { DangerZone } from '@/components/service/DangerZone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ServicesList } from '@/components/dashboard/ServicesList';
import { DeploysList } from '@/components/dashboard/DeploysList';
import { ConfirmActionModal } from '@/components/modals/ConfirmActionModal';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  fetchDeploys,
  fetchProjects,
  fetchRegistryCredentials,
  fetchScmCredentials,
  fetchServices,
  fetchTeams,
  performAction,
} from '@/lib/data';
import { isFailedDeployStatus, isSuccessfulDeployStatus } from '@/lib/deploy-status';
import type { Deploy, Project, RegistryCredential, ScmCredential, Service, Team } from '@/types/releasea';
import { getEnvironmentConfigs } from '@/lib/environments';

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectTeamId, setProjectTeamId] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectOwner, setProjectOwner] = useState('');
  const [projectRepoUrl, setProjectRepoUrl] = useState('');
  const [projectRunbookUrl, setProjectRunbookUrl] = useState('');
  const [projectAlertChannel, setProjectAlertChannel] = useState('');
  const [projectCostCenter, setProjectCostCenter] = useState('');
  const [projectDefaultEnvironment, setProjectDefaultEnvironment] = useState('dev');
  const [projectDataClassification, setProjectDataClassification] =
    useState<'public' | 'internal' | 'confidential' | 'restricted'>('internal');
  const [projectServiceTier, setProjectServiceTier] =
    useState<'standard' | 'business-critical' | 'mission-critical'>('standard');
  const [projectScmCredentialId, setProjectScmCredentialId] = useState('inherit');
  const [projectRegistryCredentialId, setProjectRegistryCredentialId] = useState('inherit');
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [scmCredentials, setScmCredentials] = useState<ScmCredential[]>([]);
  const [registryCredentials, setRegistryCredentials] = useState<RegistryCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      const [projectsData, teamsData, servicesData, deploysData, scmData, registryData] = await Promise.all([
        fetchProjects(),
        fetchTeams(),
        fetchServices(),
        fetchDeploys(),
        fetchScmCredentials(),
        fetchRegistryCredentials(),
      ]);
      if (!active) return;
      setProjects(projectsData);
      setTeams(teamsData);
      setServices(servicesData);
      setDeploys(deploysData);
      setScmCredentials(scmData);
      setRegistryCredentials(registryData);
      setIsLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const project = useMemo(() => projects.find((item) => item.id === id), [projects, id]);

  const projectServices = useMemo(
    () => (project ? services.filter((service) => service.projectId === project.id) : []),
    [project, services]
  );

  const serviceIds = useMemo(
    () => new Set(projectServices.map((service) => service.id)),
    [projectServices]
  );

  const projectDeploys = useMemo(
    () => deploys.filter((deploy) => serviceIds.has(deploy.serviceId)),
    [serviceIds, deploys]
  );

  useEffect(() => {
    if (!project) return;
    setProjectName(project.name);
    setProjectTeamId(project.teamId);
    setProjectDescription(project.description || '');
    setProjectOwner(project.owner || '');
    setProjectRepoUrl(project.repositoryUrl || '');
    setProjectRunbookUrl(project.runbookUrl || '');
    setProjectAlertChannel(project.alertChannel || '');
    setProjectCostCenter(project.costCenter || '');
    setProjectDefaultEnvironment(project.defaultEnvironment || 'dev');
    setProjectDataClassification(project.dataClassification || 'internal');
    setProjectServiceTier(project.serviceTier || 'standard');
    setProjectScmCredentialId(project.scmCredentialId || 'inherit');
    setProjectRegistryCredentialId(project.registryCredentialId || 'inherit');
  }, [project]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Project not found</p>
            <PageBackLink to="/projects" label="Projects" className="mx-auto" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const serviceDetailsOrigin = {
    pathname: `/projects/${project.id}`,
    label: project.name,
  };

  const teamName = teams.find((team) => team.id === project.teamId)?.name || 'N/A';
  const runningServices = projectServices.filter((service) => service.status === 'running').length;
  const successDeploys = projectDeploys.filter((deploy) => isSuccessfulDeployStatus(deploy.status)).length;
  const failedDeploys = projectDeploys.filter((deploy) => isFailedDeployStatus(deploy.status)).length;
  const deploySuccessRate =
    projectDeploys.length === 0 ? 0 : Math.round((successDeploys / projectDeploys.length) * 100);
  const environmentOptions = getEnvironmentConfigs();
  const projectScmOptions = scmCredentials.filter(
    (cred) => cred.scope === 'platform' || (cred.scope === 'project' && cred.projectId === project?.id)
  );
  const projectRegistryOptions = registryCredentials.filter(
    (cred) => cred.scope === 'platform' || (cred.scope === 'project' && cred.projectId === project?.id)
  );

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const scmCredentialId = projectScmCredentialId === 'inherit' ? '' : projectScmCredentialId;
    const registryCredentialId =
      projectRegistryCredentialId === 'inherit' ? '' : projectRegistryCredentialId;
    await performAction({
      endpoint: `/projects/${project.id}`,
      method: 'PUT',
      payload: {
        name: projectName,
        teamId: projectTeamId,
        description: projectDescription,
        owner: projectOwner,
        repositoryUrl: projectRepoUrl,
        runbookUrl: projectRunbookUrl,
        alertChannel: projectAlertChannel,
        costCenter: projectCostCenter,
        defaultEnvironment: projectDefaultEnvironment,
        dataClassification: projectDataClassification,
        serviceTier: projectServiceTier,
        scmCredentialId,
        registryCredentialId,
      },
      label: 'updateProject',
    });
    setProjects((prev) =>
      prev.map((item) =>
        item.id === project.id
          ? {
              ...item,
              name: projectName,
              teamId: projectTeamId,
              description: projectDescription,
              owner: projectOwner,
              repositoryUrl: projectRepoUrl,
              runbookUrl: projectRunbookUrl,
              alertChannel: projectAlertChannel,
              costCenter: projectCostCenter,
              defaultEnvironment: projectDefaultEnvironment as Project['defaultEnvironment'],
              dataClassification: projectDataClassification as Project['dataClassification'],
              serviceTier: projectServiceTier as Project['serviceTier'],
              scmCredentialId: scmCredentialId || undefined,
              registryCredentialId: registryCredentialId || undefined,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    setIsSaving(false);
    toast({ title: 'Project updated', description: 'Settings saved successfully.' });
  };

  const handleDeleteProject = async () => {
    const ok = await performAction({
      endpoint: `/projects/${project.id}`,
      method: 'DELETE',
      label: 'deleteProject',
    });
    if (!ok) {
      toast({
        title: 'Cannot delete project',
        description: 'Make sure all services are not deployed and all routes are unpublished.',
      });
      return;
    }
    toast({ title: 'Project deleted', description: `Project "${project.name}" was deleted.` });
    navigate('/projects');
  };

  const tabs: TabItem[] = [
    {
      id: 'services',
      label: 'Services',
      icon: Server,
      content: (
        <ServicesList
          services={projectServices}
          deploys={projectDeploys}
          projects={projects}
          showHeader
          title="Services"
          meta={`${projectServices.length} total`}
          origin={serviceDetailsOrigin}
        />
      ),
    },
    {
      id: 'deploys',
      label: 'Deploys',
      icon: Rocket,
      content: <DeploysList deploys={projectDeploys} services={projectServices} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      content: (
        <div className="space-y-6">
          <SettingsSection title="Project details" description="Update project information.">
            <SettingsGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-muted/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-team">Team</Label>
                <Select value={projectTeamId} onValueChange={setProjectTeamId}>
                  <SelectTrigger id="project-team" className="bg-muted/40">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe the purpose of this project"
                  className="bg-muted/40 resize-none"
                  rows={3}
                />
              </div>
            </SettingsGrid>
            <SettingsGrid columns={2} className="mt-4">
              <SettingsField label="Created" value={format(new Date(project.createdAt), 'MMM dd, yyyy HH:mm')} />
              <SettingsField label="Updated" value={format(new Date(project.updatedAt), 'MMM dd, yyyy HH:mm')} />
            </SettingsGrid>
          </SettingsSection>

          <SettingsSection
            title="Build credentials"
            description="Set project-level credentials for builds and image publishing."
          >
            <SettingsGrid columns={2}>
              <div className="space-y-2">
                <Label>SCM credential</Label>
                <Select value={projectScmCredentialId} onValueChange={setProjectScmCredentialId}>
                  <SelectTrigger className="bg-muted/40">
                    <SelectValue placeholder="Inherit platform default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit platform default</SelectItem>
                    {projectScmOptions.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name} · {cred.provider || 'github'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registry credential</Label>
                <Select
                  value={projectRegistryCredentialId}
                  onValueChange={setProjectRegistryCredentialId}
                >
                  <SelectTrigger className="bg-muted/40">
                    <SelectValue placeholder="Inherit platform default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit platform default</SelectItem>
                    {projectRegistryOptions.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name} · {cred.registryUrl || cred.provider || 'registry'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SettingsGrid>
            <p className="text-xs text-muted-foreground">
              Services can override these credentials in their own settings.
            </p>
          </SettingsSection>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>

          <DangerZone
            title="Danger zone"
            description="Deleting a project permanently removes all associated services and deployment history."
            actionLabel="Delete project"
            actionDescription="This action cannot be undone."
            onAction={() => setDeleteProjectOpen(true)}
          />
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-4">
          <PageBackLink to="/projects" label="Projects" />

          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {teamName}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {projectServices.length} services
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => navigate(`/services/new?project=${project.id}`)}>
                  <Plus className="w-4 h-4" />
                  New Service
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Project overview</h2>
              <p className="text-sm text-muted-foreground">
                {project.description || 'Track services and deployments for this project.'}
              </p>
            </div>
          </div>

          <QuickStatsGrid
            columns={2}
            stats={[
              {
                label: 'Services',
                value: `${runningServices}/${projectServices.length}`,
                sublabel: `Updated ${format(new Date(project.updatedAt), 'MMM dd, yyyy HH:mm')}`,
              },
              {
                label: 'Deploy Success',
                value: `${deploySuccessRate}%`,
                sublabel: `${successDeploys} success, ${failedDeploys} failed`,
              },
            ]}
          />
        </div>

        <TabsWrapper tabs={tabs} defaultValue="services" />
      </div>

      <ConfirmActionModal
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        title="Delete project"
        description="This action cannot be undone."
        details={
          <p className="text-sm text-muted-foreground">
            You are about to delete the project <span className="font-mono text-foreground">"{project.name}"</span> and all its associated services.
          </p>
        }
        variant="destructive"
        confirmPhrase="delete"
        confirmLabel="Delete project"
        onConfirm={handleDeleteProject}
      />
    </AppLayout>
  );
};

export default ProjectDetails;
