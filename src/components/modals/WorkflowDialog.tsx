import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WorkflowDialogSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<WorkflowDialogSize, string> = {
  sm: 'sm:max-w-[480px]',
  md: 'sm:max-w-[620px]',
  lg: 'sm:max-w-[780px]',
  xl: 'sm:max-w-[960px]',
};

type WorkflowDialogContentProps = ComponentPropsWithoutRef<typeof DialogContent> & {
  size?: WorkflowDialogSize;
};

/**
 * Shared frame for multi-field and multi-step dialogs.
 * It keeps the title and actions visible while only the content area scrolls.
 */
export function WorkflowDialogContent({
  size = 'md',
  className,
  children,
  ...props
}: WorkflowDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        'flex max-h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border bg-card p-0',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function WorkflowDialogHeader({
  title,
  description,
  icon,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5 pr-14">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <DialogTitle className="text-lg font-semibold leading-6">{title}</DialogTitle>
            {description && (
              <DialogDescription className="max-w-2xl text-sm leading-5">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>
        {meta && <div className="shrink-0">{meta}</div>}
      </div>
    </DialogHeader>
  );
}

export function WorkflowDialogBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)}>{children}</div>;
}

export function WorkflowDialogFooter({
  className,
  children,
  split = false,
}: {
  className?: string;
  children: ReactNode;
  split?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-h-16 shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-muted/10 px-6 py-3 sm:flex-row sm:items-center',
        split ? 'sm:justify-between' : 'sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkflowDialogSection({
  title,
  description,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
          {description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function WorkflowDialogSteps({
  steps,
  activeStep,
}: {
  steps: string[];
  activeStep: number;
}) {
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === activeStep ? 'step' : undefined}
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs',
            index === activeStep
              ? 'border-primary/40 bg-primary/5 font-medium text-primary'
              : index < activeStep
                ? 'border-border bg-muted/20 text-foreground'
                : 'border-border text-muted-foreground',
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
            {index + 1}
          </span>
          <span className="truncate">{step}</span>
        </li>
      ))}
    </ol>
  );
}
