import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EnvVar } from '@/forms/types';

type EnvironmentVariablesSectionProps = {
  title: string;
  description: ReactNode;
  hint?: ReactNode;
  envVars: EnvVar[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof EnvVar, value: string) => void;
  onRemove: (id: string) => void;
};

export function EnvironmentVariablesSection({
  title,
  description,
  hint,
  envVars,
  onAdd,
  onUpdate,
  onRemove,
}: EnvironmentVariablesSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onAdd}>
          Add variable
        </Button>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-3">
          {envVars.map((variable) => (
            <div key={variable.id} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
              <Input
                placeholder="KEY"
                value={variable.key}
                onChange={(event) => onUpdate(variable.id, 'key', event.target.value)}
                className="bg-muted/50 font-mono text-sm"
              />
              <Input
                placeholder="value"
                value={variable.value}
                onChange={(event) => onUpdate(variable.id, 'value', event.target.value)}
                className="bg-muted/50 font-mono text-sm"
              />
              <Select
                value={variable.type}
                onValueChange={(value) => onUpdate(variable.id, 'type', value as EnvVar['type'])}
              >
                <SelectTrigger className="bg-muted/50">
                  <SelectValue placeholder="Plain Text" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain Text</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => onRemove(variable.id)}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          ))}
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </section>
  );
}
