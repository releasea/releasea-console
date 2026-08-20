import { BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  catalogBlueprints,
  getCatalogBlueprint,
  getCatalogBlueprintId,
  getTemplateStarterFrameworkLabel,
  type CatalogBlueprintId,
  type CatalogTemplate,
} from './catalog';

type ServiceTemplateCatalogStepProps = {
  catalogQuery: string;
  templates: CatalogTemplate[];
  filteredTemplates: CatalogTemplate[];
  onCatalogQueryChange: (value: string) => void;
  blueprintFilter: CatalogBlueprintId | 'all';
  onBlueprintFilterChange: (value: CatalogBlueprintId | 'all') => void;
  frameworkFilter: string;
  frameworkOptions: Array<{ value: string; label: string; count: number }>;
  onFrameworkFilterChange: (value: string) => void;
  onTemplateSelect: (template: CatalogTemplate) => void;
  onManageTemplates: () => void;
};

export function ServiceTemplateCatalogStep({
  catalogQuery,
  templates,
  filteredTemplates,
  onCatalogQueryChange,
  blueprintFilter,
  onBlueprintFilterChange,
  frameworkFilter,
  frameworkOptions,
  onFrameworkFilterChange,
  onTemplateSelect,
  onManageTemplates,
}: ServiceTemplateCatalogStepProps) {
  const verifiedCount = templates.filter((template) => template.verification?.status === 'verified').length;
  const needsReviewCount = templates.filter((template) => template.verification?.status !== 'verified').length;
  const groupedTemplates = catalogBlueprints
    .map((blueprint) => ({
      blueprint,
      templates: filteredTemplates.filter((template) => getCatalogBlueprintId(template) === blueprint.id),
    }))
    .filter((group) => group.templates.length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Service catalog</p>
            <h2 className="text-xl font-semibold text-foreground">Choose a template</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Browse curated blueprints with consistent defaults for security, scaling, and monitoring.
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            {filteredTemplates.length} of {templates.length} templates · {verifiedCount} verified · {needsReviewCount} need review
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={catalogQuery}
              onChange={(event) => onCatalogQueryChange(event.target.value)}
              className="pl-9 bg-muted/40"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Blueprint catalog</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={blueprintFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => onBlueprintFilterChange('all')}
                >
                  All workloads
                </Button>
                {catalogBlueprints.map((blueprint) => {
                  const count = templates.filter((template) => getCatalogBlueprintId(template) === blueprint.id).length;
                  return (
                    <Button
                      key={blueprint.id}
                      type="button"
                      size="sm"
                      variant={blueprintFilter === blueprint.id ? 'default' : 'outline'}
                      onClick={() => onBlueprintFilterChange(blueprint.id)}
                    >
                      {blueprint.label} · {count}
                    </Button>
                  );
                })}
              </div>
            </div>

            {frameworkOptions.length > 0 && (
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Starter paths</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={frameworkFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => onFrameworkFilterChange('all')}
                  >
                    All frameworks
                  </Button>
                  {frameworkOptions.map((framework) => (
                    <Button
                      key={framework.value}
                      type="button"
                      size="sm"
                      variant={frameworkFilter === framework.value ? 'default' : 'outline'}
                      onClick={() => onFrameworkFilterChange(framework.value)}
                    >
                      {framework.label} · {framework.count}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Create your own templates</p>
              <p className="text-xs text-muted-foreground">
                Import templates from Settings to define repositories, runtime, and scheduling defaults.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={onManageTemplates}>
              <BookOpen className="h-4 w-4" />
              Manage templates
            </Button>
          </div>
        </div>
      </section>

      {groupedTemplates.length > 0 ? (
        <div className="space-y-6">
          {groupedTemplates.map(({ blueprint, templates: groupTemplates }) => (
            <section key={blueprint.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/20 px-5 py-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{blueprint.label}</h3>
                  <p className="text-sm text-muted-foreground">{blueprint.description}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {groupTemplates.length} {groupTemplates.length === 1 ? 'template' : 'templates'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                {groupTemplates.map((option) => {
                  const {
                    id,
                    label,
                    description,
                    icon: Icon,
                    category,
                    owner,
                    bestFor,
                    defaults,
                    setupTime,
                    tier,
                    repoMode,
                  } = option;
                  const starterFramework = getTemplateStarterFrameworkLabel(option);
                  const optionBlueprint = getCatalogBlueprint(option);
                  const verificationStatus = option.verification?.status ?? 'needs-review';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onTemplateSelect(option)}
                      className={cn(
                        'group flex h-full min-h-[336px] flex-col rounded-lg border border-border bg-background p-5 text-left transition-colors',
                        'hover:border-primary/40 hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-primary/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{category}</p>
                            <h2 className="text-base font-semibold text-foreground">{label}</h2>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{tier}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[11px] font-medium text-foreground">
                          {optionBlueprint.label}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-1 text-[11px] font-medium',
                            verificationStatus === 'verified'
                              ? 'border-success/30 bg-success/10 text-success'
                              : verificationStatus === 'invalid'
                                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                : 'border-warning/30 bg-warning/10 text-warning',
                          )}
                        >
                          {verificationStatus === 'verified' ? 'Verified defaults' : verificationStatus === 'invalid' ? 'Invalid' : 'Needs review'}
                        </span>
                        {starterFramework ? (
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                            Starter: {starterFramework}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[11px] font-medium text-foreground">
                          {repoMode === 'existing' ? 'Existing source' : 'Scaffolded repo'}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-5 text-muted-foreground line-clamp-3 min-h-[3.75rem]">
                        {description}
                      </p>
                      <p className="mt-2 min-h-[2rem] text-xs text-muted-foreground line-clamp-2">
                        {option.verification?.summary ?? 'Template metadata and defaults are ready for review before creation.'}
                      </p>

                      <div className="mt-4 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-md border border-border text-xs">
                        <div className="min-w-0 space-y-1 p-3">
                          <span className="block text-muted-foreground">Best for</span>
                          <span className="block truncate font-medium text-foreground" title={bestFor}>{bestFor}</span>
                        </div>
                        <div className="min-w-0 space-y-1 p-3">
                          <span className="block text-muted-foreground">Defaults</span>
                          <span className="block truncate font-medium text-foreground" title={defaults}>{defaults}</span>
                        </div>
                        <div className="min-w-0 space-y-1 p-3">
                          <span className="block text-muted-foreground">Setup time</span>
                          <span className="block truncate font-medium text-foreground" title={setupTime}>{setupTime}</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-6 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Maintained by {owner}</span>
                        <span className="font-medium text-foreground">Select template</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No templates match your search. Try a different keyword or filter.
        </div>
      )}
    </div>
  );
}
