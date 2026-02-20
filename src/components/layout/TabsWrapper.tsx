import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: ReactNode;
}

interface TabsWrapperProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  contentClassName?: string;
}

export function TabsWrapper({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
  contentClassName,
}: TabsWrapperProps) {
  return (
    <Tabs
      defaultValue={defaultValue ?? tabs[0]?.id}
      value={value}
      onValueChange={onValueChange}
      className={cn('space-y-4', className)}
    >
      <TabsList className="bg-muted/50 flex w-full flex-wrap justify-start">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className={cn('space-y-4', contentClassName)}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
