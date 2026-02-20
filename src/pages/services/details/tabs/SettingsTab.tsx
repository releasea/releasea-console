import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from '@/components/layout/SettingsSection';
import { TabsContent } from '@/components/ui/tabs';
import { DangerZone } from '@/components/service/DangerZone';
import { EnvironmentVariablesSection } from '@/forms/components/EnvironmentVariablesSection';
import { useServiceSettingsFormStore } from '@/forms/store/service-settings-form-store';
import type { DeployStrategyType } from '@/types/releasea';
import { Power } from 'lucide-react';
import { frameworkOptions } from '../constants';
export const SettingsTab = () => {
  const {
    service,
    projects,
    projectId,
    onProjectChange,
    source,
    runtime,
    deployment,
    operations,
    envVars,
    credentials,
    staticSite,
    scheduledJob,
    settingsSaving,
    onSubmit,
    onDiscard,
    isServiceActive,
    onToggleServiceActive,
    onDeleteService,
  } = useServiceSettingsFormStore();
  return (
  <TabsContent value="settings" className="space-y-6">
    <form onSubmit={onSubmit} className="space-y-6">
      <SettingsSection
        title="Service details"
        description="Manage the service name and project assignment."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="serviceName">Service Name</Label>
            <Input
              id="serviceName"
              value={service.name}
              disabled
              className="bg-muted/40 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Service name cannot be changed.</p>
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={onProjectChange}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      {service.type === 'microservice' && (
        <>
          <SettingsSection title="Source type">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => source.setType('git')}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    source.type === 'git'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <span className="text-sm font-medium">Git Repository</span>
                  <p className="text-xs text-muted-foreground mt-1">Build from a repo with Dockerfile</p>
                </button>
                <button
                  type="button"
                  onClick={() => source.setType('docker')}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    source.type === 'docker'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <span className="text-sm font-medium">Docker Image</span>
                  <p className="text-xs text-muted-foreground mt-1">Deploy an existing image</p>
                </button>
              </div>

              {source.type === 'git' ? (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="repoUrl">Repository URL</Label>
                    <Input
                      id="repoUrl"
                      value={source.repoUrl}
                      onChange={(e) => source.setRepoUrl(e.target.value)}
                      className="bg-muted/50 font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch</Label>
                      <Input
                        id="branch"
                        value={source.branch}
                        onChange={(e) => source.setBranch(e.target.value)}
                        className="bg-muted/50 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rootDir">Root Directory</Label>
                      <Input
                        id="rootDir"
                        value={source.rootDir}
                        onChange={(e) => source.setRootDir(e.target.value)}
                        className="bg-muted/50 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="targetImage">Target Image</Label>
                      <Input
                        id="targetImage"
                        value={source.dockerImage}
                        onChange={(e) => source.setDockerImage(e.target.value)}
                        placeholder="registry.example.com/org/service:latest"
                        className="bg-muted/50 font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Image tag used when the worker builds and pushes this service.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="dockerImage">Docker Image</Label>
                  <Input
                    id="dockerImage"
                    value={source.dockerImage}
                    onChange={(e) => source.setDockerImage(e.target.value)}
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </SettingsSection>

          {scheduledJob.enabled && (
            <SettingsSection
              title="Schedule"
              description="Configure the cron schedule and runtime command for this job."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduleCron">Cron expression</Label>
                  <Input
                    id="scheduleCron"
                    value={scheduledJob.scheduleCron}
                    onChange={(e) => scheduledJob.setScheduleCron(e.target.value)}
                    placeholder="0 2 * * *"
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduleTimezone">Timezone</Label>
                  <Input
                    id="scheduleTimezone"
                    value={scheduledJob.scheduleTimezone}
                    onChange={(e) => scheduledJob.setScheduleTimezone(e.target.value)}
                    placeholder="UTC"
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="scheduleCommand">Job command</Label>
                  <Input
                    id="scheduleCommand"
                    value={scheduledJob.scheduleCommand}
                    onChange={(e) => scheduledJob.setScheduleCommand(e.target.value)}
                    placeholder="node scripts/run.js"
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduleRetries">Retries</Label>
                  <Input
                    id="scheduleRetries"
                    type="number"
                    min="0"
                    value={scheduledJob.scheduleRetries}
                    onChange={(e) => scheduledJob.setScheduleRetries(e.target.value)}
                    className="bg-muted/50 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduleTimeout">Timeout (seconds)</Label>
                  <Input
                    id="scheduleTimeout"
                    type="number"
                    min="0"
                    value={scheduledJob.scheduleTimeout}
                    onChange={(e) => scheduledJob.setScheduleTimeout(e.target.value)}
                    className="bg-muted/50 font-mono"
                  />
                </div>
              </div>
            </SettingsSection>
          )}

          <SettingsSection title="Runtime settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={runtime.servicePort}
                  onChange={(e) => runtime.setServicePort(e.target.value)}
                  className="bg-muted/50 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="healthCheckPath">Health Check Path</Label>
                <Input
                  id="healthCheckPath"
                  value={runtime.healthCheckPath}
                  onChange={(e) => runtime.setHealthCheckPath(e.target.value)}
                  className="bg-muted/50 font-mono"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Deployment strategy"
            description="Traffic shifting is applied in Istio, but the strategy is defined per microservice for clarity."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Strategy</Label>
                <Select
                  value={deployment.deployStrategyType}
                  onValueChange={(value) => deployment.setDeployStrategyType(value as DeployStrategyType)}
                >
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rolling">Rolling</SelectItem>
                    <SelectItem value="canary">Canary</SelectItem>
                    <SelectItem value="blue-green">Blue/Green</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {deployment.deployStrategyType === 'canary' && (
                <div className="space-y-2">
                  <Label htmlFor="canaryPercent">Canary traffic (%)</Label>
                  <Input
                    id="canaryPercent"
                    type="number"
                    min="0"
                    max="100"
                    value={deployment.canaryPercent}
                    onChange={(e) => deployment.setCanaryPercent(e.target.value)}
                    className="bg-muted/50 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Traffic distribution performed at the application entry router.</p>
                </div>
              )}
              {deployment.deployStrategyType === 'blue-green' && (
                <div className="space-y-2">
                  <Label>Active color</Label>
                  <Select
                    value={deployment.blueGreenPrimary}
                    onValueChange={(value) => deployment.setBlueGreenPrimary(value as 'blue' | 'green')}
                  >
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Switching flips Istio traffic to the active pool.</p>
                </div>
              )}
            </div>
            {deployment.deployStrategyType !== (service.deploymentStrategy?.type ?? 'rolling') && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 mt-4">
                <p className="text-xs font-medium text-warning">Deploy strategy changed</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This change republishes traffic routing and may cause brief instability during transition.
                  If a canary was active and you switch to Rolling, the next deploy removes canary resources
                  and restores 100% traffic to the main version.
                </p>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="Operational settings">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Pause when idle</p>
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Coming soon</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically scales to zero after the configured idle timeout without HTTP requests.
                  </p>
                </div>
                <Switch checked={false} disabled />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Profile Type</Label>
                  <Select value={operations.profileId} onValueChange={operations.setProfileId}>
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue placeholder="Select profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {operations.profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.cpu}, {profile.memory})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="minReplicas">Minimum Replicas</Label>
                    <Input
                      id="minReplicas"
                      type="number"
                      min="1"
                      value={operations.minReplicas}
                      onChange={(e) => operations.setMinReplicas(e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxReplicas">Maximum Replicas</Label>
                    <Input
                      id="maxReplicas"
                      type="number"
                      min="1"
                      value={operations.maxReplicas}
                      onChange={(e) => operations.setMaxReplicas(e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>

          <EnvironmentVariablesSection
            title="Environment variables"
            description="Key-value pairs injected at build and runtime."
            hint={
              <>
                Use secret references for sensitive values, e.g.{' '}
                <span className="font-mono">{'vault://team/app/{{env}}#password'}</span>.
              </>
            }
            envVars={envVars.items}
            onAdd={envVars.add}
            onUpdate={envVars.update}
            onRemove={envVars.remove}
          />

          <SettingsSection title="Advanced settings">
            {source.type === 'git' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dockerContext">Docker Context</Label>
                  <Input
                    id="dockerContext"
                    value={source.dockerContext}
                    onChange={(e) => source.setDockerContext(e.target.value)}
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dockerfilePath">Dockerfile Path</Label>
                  <Input
                    id="dockerfilePath"
                    value={source.dockerfilePath}
                    onChange={(e) => source.setDockerfilePath(e.target.value)}
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dockerCommand">Docker Command</Label>
                  <Input
                    id="dockerCommand"
                    value={source.dockerCommand}
                    onChange={(e) => source.setDockerCommand(e.target.value)}
                    placeholder="Override CMD/ENTRYPOINT"
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preDeployCommand">Pre-Deploy Command</Label>
                  <Input
                    id="preDeployCommand"
                    value={source.preDeployCommand}
                    onChange={(e) => source.setPreDeployCommand(e.target.value)}
                    placeholder="e.g. npm run migrate"
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 md:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-deploy on new commits</p>
                    <p className="text-xs text-muted-foreground">Trigger deploys on repository updates.</p>
                  </div>
                  <Switch checked={source.autoDeploy} onCheckedChange={source.setAutoDeploy} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No build options are required when deploying a pre-built image.
              </div>
            )}
          </SettingsSection>
        </>
      )}

      <SettingsSection
        title="Build credentials"
        description="Override project defaults for repository access and image publishing."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {source.type === 'git' && (
            <div className="space-y-2">
              <Label>SCM credential</Label>
              <Select value={credentials.serviceScmCredentialId} onValueChange={credentials.setServiceScmCredentialId}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue placeholder="Inherit project default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Inherit project default</SelectItem>
                  {credentials.scopedScmCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      {cred.name} · {cred.provider || 'github'} · {credentials.credentialScopeLabel(cred.scope)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Registry credential</Label>
            <Select
              value={credentials.serviceRegistryCredentialId}
              onValueChange={credentials.setServiceRegistryCredentialId}
            >
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Inherit project default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Inherit project default</SelectItem>
                {credentials.scopedRegistryCredentials.map((cred) => (
                  <SelectItem key={cred.id} value={cred.id}>
                    {cred.name} · {cred.registryUrl || cred.provider || 'registry'} · {credentials.credentialScopeLabel(cred.scope)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Secret provider</Label>
            <Select value={credentials.serviceSecretProviderId} onValueChange={credentials.setServiceSecretProviderId}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Inherit platform default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Inherit platform default</SelectItem>
                {credentials.secretProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} · {provider.type.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use secret references in env vars (ex:{' '}
              <span className="font-mono">{'vault://team/app/{{env}}#password'}</span>).
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          These credentials apply to build and publish operations for this service.
        </p>
      </SettingsSection>

      {service.type === 'static-site' && (
        <>
          <SettingsSection title="Source">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staticRepo">Repository URL</Label>
                <Input
                  id="staticRepo"
                  value={source.repoUrl}
                  onChange={(e) => source.setRepoUrl(e.target.value)}
                  className="bg-muted/50 font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="staticBranch">Branch</Label>
                  <Input
                    id="staticBranch"
                    value={source.branch}
                    onChange={(e) => source.setBranch(e.target.value)}
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staticRoot">Root Directory</Label>
                  <Input
                    id="staticRoot"
                    value={source.rootDir}
                    onChange={(e) => source.setRootDir(e.target.value)}
                    className="bg-muted/50 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Build settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Framework</Label>
                <Select value={staticSite.framework} onValueChange={staticSite.setFramework}>
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworkOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="installCommand">Install Command</Label>
                <Input
                  id="installCommand"
                  value={staticSite.installCommand}
                  onChange={(e) => staticSite.setInstallCommand(e.target.value)}
                  className="bg-muted/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildCommand">Build Command</Label>
                <Input
                  id="buildCommand"
                  value={staticSite.buildCommand}
                  onChange={(e) => staticSite.setBuildCommand(e.target.value)}
                  className="bg-muted/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputDir">Output Directory</Label>
                <Input
                  id="outputDir"
                  value={staticSite.outputDir}
                  onChange={(e) => staticSite.setOutputDir(e.target.value)}
                  className="bg-muted/50 font-mono text-sm"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="CDN & cache">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cacheTtl">Cache TTL (seconds)</Label>
                <Input
                  id="cacheTtl"
                  value={staticSite.cacheTtl}
                  onChange={(e) => staticSite.setCacheTtl(e.target.value)}
                  className="bg-muted/50 font-mono text-sm"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-deploy on new commits</p>
                  <p className="text-xs text-muted-foreground">Deploy a new build on updates.</p>
                </div>
                <Switch checked={source.autoDeploy} onCheckedChange={source.setAutoDeploy} />
              </div>
            </div>
          </SettingsSection>

          <EnvironmentVariablesSection
            title="Environment variables"
            description="Variables used during the build."
            hint={
              <>
                Secret values can reference managers, e.g.{' '}
                <span className="font-mono">aws://payments-db#password</span>.
              </>
            }
            envVars={envVars.items}
            onAdd={envVars.add}
            onUpdate={envVars.update}
            onRemove={envVars.remove}
          />
        </>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onDiscard}>
          Cancel
        </Button>
        <Button type="submit" disabled={settingsSaving}>
          {settingsSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </form>

    <div className="rounded-lg border border-warning/40 bg-warning/5 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-warning">Traffic Control</h3>
        <p className="text-xs text-muted-foreground">
          Disabling a service will stop traffic and may stop running instances immediately.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {isServiceActive ? 'Deactivate this service' : 'Activate this service'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isServiceActive
              ? 'All incoming traffic will be blocked until the service is reactivated.'
              : 'Traffic will resume and new deploys will be allowed.'}
          </p>
        </div>
        <Button
          variant={isServiceActive ? 'destructive' : 'default'}
          className="gap-2"
          onClick={onToggleServiceActive}
        >
          <Power className="w-4 h-4" />
          {isServiceActive ? 'Confirm deactivation' : 'Confirm activation'}
        </Button>
      </div>
    </div>

    <DangerZone
      title="Danger zone"
      description="Deleting a service permanently removes its configuration, rules, and deployment history."
      actionLabel="Delete service"
      actionDescription="This action cannot be undone and will stop all active deployments."
      onAction={onDeleteService}
    />
  </TabsContent>
  );
};
