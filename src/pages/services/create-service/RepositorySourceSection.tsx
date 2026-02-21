import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCreateServiceFormStore } from '@/forms/store/create-service-form-store';

type RepositorySourceSectionProps = {
  allowTemplateToggle: boolean;
  repoInputId: string;
  repoPlaceholder: string;
  branchInputId: string;
  rootDirInputId: string;
};

export function RepositorySourceSection({
  allowTemplateToggle,
  repoInputId,
  repoPlaceholder,
  branchInputId,
  rootDirInputId,
}: RepositorySourceSectionProps) {
  const {
    repoMode,
    handleRepoModeChange,
    isTemplateMode,
    templateRepoUrl,
    templateRepoAvailability,
    templateRepoAvailabilityMessage,
    repoUrl,
    setRepoUrl,
    branch,
    setBranch,
    rootDir,
    setRootDir,
  } = useCreateServiceFormStore();

  return (
    <>
      {allowTemplateToggle ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Repository Source</p>
              <p className="text-xs text-muted-foreground">
                Create a repo from the platform template or connect an existing repository.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleRepoModeChange('template')}
              className={cn(
                'h-full rounded-lg border px-4 py-3 text-left transition-colors',
                repoMode === 'template'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground'
              )}
            >
              <span className="text-sm font-medium">Create from template</span>
              <p className="text-xs text-muted-foreground mt-1">1-click repo creation with platform defaults</p>
            </button>
            <button
              type="button"
              onClick={() => handleRepoModeChange('existing')}
              className={cn(
                'h-full rounded-lg border px-4 py-3 text-left transition-colors',
                repoMode === 'existing'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground'
              )}
            >
              <span className="text-sm font-medium">Use existing repo</span>
              <p className="text-xs text-muted-foreground mt-1">Connect a repository you already manage</p>
            </button>
          </div>
        </div>
      ) : null}

      {repoMode === 'template' ? (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor={repoInputId}>Repository URL</Label>
            <Input
              id={repoInputId}
              value={repoUrl || templateRepoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder={repoPlaceholder}
              className="bg-muted/50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Generated from the selected SCM credential and project context. You can edit it.
            </p>
          </div>
          {templateRepoAvailability === 'checking' ? (
            <p className="text-xs text-muted-foreground">Checking if the GitHub repository already exists...</p>
          ) : null}
          {templateRepoAvailability === 'exists' ? (
            <p className="text-xs text-destructive">{templateRepoAvailabilityMessage}</p>
          ) : null}
          {templateRepoAvailability === 'error' ? (
            <p className="text-xs text-amber-600">
              Could not verify repository availability now. You can try again in a moment.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <Label htmlFor={repoInputId}>Repository URL</Label>
          <Input
            id={repoInputId}
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder={repoPlaceholder}
            className="bg-muted/50 font-mono text-sm"
            required
          />
        </div>
      )}

      {!isTemplateMode ? (
        <div className="rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={branchInputId}>Branch</Label>
              <Input
                id={branchInputId}
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={rootDirInputId}>Root Directory</Label>
              <Input
                id={rootDirInputId}
                value={rootDir}
                onChange={(event) => setRootDir(event.target.value)}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
