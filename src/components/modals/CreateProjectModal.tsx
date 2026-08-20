import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FolderKanban, Plus, Rocket, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { createProject, fetchRegistryCredentials, fetchScmCredentials, fetchTeams } from '@/lib/data';
import { getEnvironmentConfigs } from '@/lib/environments';
import type { Environment, Project, RegistryCredential, ScmCredential, Team } from '@/types/releasea';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}

export function CreateProjectModal({ open, onOpenChange, onCreated }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [defaultEnvironment, setDefaultEnvironment] = useState<Environment>('dev');
  const [serviceTier, setServiceTier] = useState<Project['serviceTier']>('standard');
  const [dataClassification, setDataClassification] = useState<Project['dataClassification']>('internal');
  const [runbookUrl, setRunbookUrl] = useState('');
  const [alertChannel, setAlertChannel] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [scmCredentialId, setScmCredentialId] = useState('none');
  const [registryCredentialId, setRegistryCredentialId] = useState('none');
  const [continueToService, setContinueToService] = useState(true);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scmCredentials, setScmCredentials] = useState<ScmCredential[]>([]);
  const [registryCredentials, setRegistryCredentials] = useState<RegistryCredential[]>([]);

  const environmentOptions = getEnvironmentConfigs();
  const stepCount = 3;
  const progress = Math.round(((step + 1) / stepCount) * 100);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [teamsData, scmData, registryData] = await Promise.all([
        fetchTeams(),
        fetchScmCredentials(),
        fetchRegistryCredentials(),
      ]);
      if (!active) return;
      setTeams(teamsData);
      setScmCredentials(scmData);
      setRegistryCredentials(registryData);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setTeamId('');
    setDefaultEnvironment('dev');
    setServiceTier('standard');
    setDataClassification('internal');
    setRunbookUrl('');
    setAlertChannel('');
    setCostCenter('');
    setScmCredentialId('none');
    setRegistryCredentialId('none');
    setContinueToService(true);
    setStep(0);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const isStepValid = useMemo(() => {
    if (step === 0) {
      return name.trim().length > 0 && slug.trim().length > 0;
    }
    if (step === 1) {
      return teamId.trim().length > 0;
    }
    return true;
  }, [name, slug, step, teamId]);

  const handleBack = () => {
    setStep((current) => Math.max(0, current - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid) return;
    if (step < stepCount - 1) {
      setStep((current) => current + 1);
      return;
    }

    setIsLoading(true);

    const newProject = await createProject({
      name,
      slug,
      description,
      teamId,
      defaultEnvironment,
      serviceTier: serviceTier || undefined,
      dataClassification: dataClassification || undefined,
      runbookUrl: runbookUrl.trim() || undefined,
      alertChannel: alertChannel.trim() || undefined,
      costCenter: costCenter.trim() || undefined,
      scmCredentialId: scmCredentialId !== 'none' ? scmCredentialId : undefined,
      registryCredentialId: registryCredentialId !== 'none' ? registryCredentialId : undefined,
    });

    toast({
      title: 'Project created',
      description: continueToService
        ? `The "${name}" project is ready. Continue by creating the first service.`
        : `The "${name}" project was created successfully.`,
    });

    setIsLoading(false);
    onOpenChange(false);
    onCreated?.(newProject);
    if (continueToService) {
      navigate(`/services/new?project=${newProject.id}`);
    }
  };

  const stepTitle =
    step === 0 ? 'Basics' : step === 1 ? 'Ownership & governance' : 'Delivery defaults';

  const stepDescription =
    step === 0
      ? 'Define the project identity and what this team owns.'
      : step === 1
        ? 'Attach the project to the right team and declare its operating posture.'
        : 'Pre-wire delivery defaults so the first services start with the right credentials and references.';

  const stepIcon =
    step === 0 ? <FolderKanban className="h-4 w-4" /> : step === 1 ? <ShieldCheck className="h-4 w-4" /> : <Rocket className="h-4 w-4" />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] bg-card border-border">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl font-semibold">Create project</DialogTitle>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Step {step + 1} of {stepCount}
            </Badge>
          </div>
          <DialogDescription>
            Create the project with ownership, governance, and delivery defaults already in place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stepTitle}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">{stepIcon}</div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{stepTitle}</p>
                <p className="text-sm text-muted-foreground">{stepDescription}</p>
              </div>
            </div>
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Payments Platform"
                  className="bg-muted/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="payments-platform"
                  className="bg-muted/50 font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">Used in URLs, APIs, ownership lookups, and generated defaults.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Owns checkout, payments, and settlement workloads."
                  className="bg-muted/50 resize-none"
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={setTeamId} required>
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue placeholder="Select..." />
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

              <div className="space-y-2">
                <Label>Default environment</Label>
                <Select value={defaultEnvironment} onValueChange={(value) => setDefaultEnvironment(value as Environment)}>
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {environmentOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Service tier</Label>
                <Select value={serviceTier ?? 'standard'} onValueChange={(value) => setServiceTier(value as Project['serviceTier'])}>
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="business-critical">Business critical</SelectItem>
                    <SelectItem value="mission-critical">Mission critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data classification</Label>
                <Select value={dataClassification ?? 'internal'} onValueChange={(value) => setDataClassification(value as Project['dataClassification'])}>
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default SCM credential</Label>
                  <Select value={scmCredentialId} onValueChange={setScmCredentialId}>
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default credential</SelectItem>
                      {scmCredentials.map((credential) => (
                        <SelectItem key={credential.id} value={credential.id}>
                          {credential.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default registry credential</Label>
                  <Select value={registryCredentialId} onValueChange={setRegistryCredentialId}>
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default credential</SelectItem>
                      {registryCredentials.map((credential) => (
                        <SelectItem key={credential.id} value={credential.id}>
                          {credential.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="runbookUrl">Runbook URL</Label>
                  <Input
                    id="runbookUrl"
                    value={runbookUrl}
                    onChange={(e) => setRunbookUrl(e.target.value)}
                    placeholder="https://docs.internal/runbooks/payments"
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alertChannel">Alert channel</Label>
                  <Input
                    id="alertChannel"
                    value={alertChannel}
                    onChange={(e) => setAlertChannel(e.target.value)}
                    placeholder="#payments-alerts"
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="costCenter">Cost center</Label>
                  <Input
                    id="costCenter"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    placeholder="finops-001"
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="continueToService"
                    checked={continueToService}
                    onCheckedChange={(checked) => setContinueToService(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="continueToService" className="text-sm font-medium text-foreground">
                      Continue directly to the first service
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      After the project is created, open the service creation flow with this project preselected.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3 border-t border-border pt-4">
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              {step > 0 && (
                <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
            </div>

            {step < stepCount - 1 ? (
              <Button type="submit" disabled={!isStepValid || isLoading} className="gap-2">
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading || !isStepValid} className="gap-2">
                <Plus className="w-4 h-4" />
                {isLoading ? 'Creating...' : continueToService ? 'Create & continue' : 'Create Project'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
