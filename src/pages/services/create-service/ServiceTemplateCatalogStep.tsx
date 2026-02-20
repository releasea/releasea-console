import { BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CatalogTemplate } from './catalog';

type ServiceTemplateCatalogStepProps = {
  catalogQuery: string;
  filteredTemplates: CatalogTemplate[];
  totalTemplates: number;
  onCatalogQueryChange: (value: string) => void;
  onTemplateSelect: (template: CatalogTemplate) => void;
  onManageTemplates: () => void;
};

export function ServiceTemplateCatalogStep({
  catalogQuery,
  filteredTemplates,
  totalTemplates,
  onCatalogQueryChange,
  onTemplateSelect,
  onManageTemplates,
}: ServiceTemplateCatalogStepProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Service catalog</p>
            <h2 className="text-xl font-semibold text-foreground">Choose a template</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Browse curated blueprints with consistent defaults for security, scaling, and monitoring.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {filteredTemplates.length} of {totalTemplates} templates · Verified defaults · Production ready
          </p>
        </div>

        <div className="mt-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={catalogQuery}
              onChange={(event) => onCatalogQueryChange(event.target.value)}
              className="pl-9 bg-muted/40"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Create your own templates</p>
            <p className="text-xs text-muted-foreground">
              Import templates from Settings to define repositories, runtime, and scheduling defaults.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onManageTemplates}>
            <BookOpen className="h-4 w-4" />
            Manage templates
          </Button>
        </div>
      </section>

      {filteredTemplates.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map((option) => {
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
            } = option;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTemplateSelect(option)}
                className={cn(
                  'group flex h-full min-h-[300px] flex-col rounded-xl border border-border/70 bg-card p-5 text-left shadow-sm transition',
                  'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40'
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

                <p className="mt-3 text-sm leading-5 text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {description}
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Best for</span>
                    <span className="font-medium text-foreground">{bestFor}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Defaults</span>
                    <span className="font-medium text-foreground">{defaults}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Setup time</span>
                    <span className="font-medium text-foreground">{setupTime}</span>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Maintained by {owner}</span>
                  <span className="font-medium text-foreground">Select template</span>
                </div>
              </button>
            );
          })}
        </section>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No templates match your search. Try a different keyword or filter.
        </div>
      )}
    </div>
  );
}
