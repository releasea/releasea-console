import { Server, Globe, Cog } from 'lucide-react';
import { ServiceType } from '@/types/releasea';
import { cn } from '@/lib/utils';

interface ServiceTypeIconProps {
  type: ServiceType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const typeConfig = {
  'static-site': { icon: Globe, color: 'text-info', bg: 'bg-info/10' },
  'microservice': { icon: Server, color: 'text-primary', bg: 'bg-primary/10' },
  'worker': { icon: Cog, color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function ServiceTypeIcon({ type, className, size = 'md' }: ServiceTypeIconProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'rounded-lg flex items-center justify-center',
      sizeClasses[size],
      config.bg,
      className
    )}>
      <Icon className={cn(iconSizes[size], config.color)} />
    </div>
  );
}

export function ServiceTypeLabel({ type }: { type: ServiceType }) {
  const labels = {
    'static-site': 'Static site',
    'microservice': 'Microservice',
    'worker': 'Worker',
  };
  return <span>{labels[type]}</span>;
}
