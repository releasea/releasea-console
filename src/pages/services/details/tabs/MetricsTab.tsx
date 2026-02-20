import { TabsContent } from '@/components/ui/tabs';
import MetricsCharts from '@/components/metrics/MetricsCharts';
import type { Metrics } from '@/types/releasea';

type MetricsTabProps = {
  metrics: Metrics | null;
  replicaOptions: string[];
  metricsFrom: Date;
  metricsTo: Date;
  metricsToNow: boolean;
  variant?: 'microservice' | 'static-site';
  onTimeRangeChange: (from: Date, to: Date, toNow?: boolean) => void;
  onRefresh: () => Promise<void>;
};

export const MetricsTab = ({
  metrics,
  replicaOptions,
  metricsFrom,
  metricsTo,
  metricsToNow,
  variant = 'microservice',
  onTimeRangeChange,
  onRefresh,
}: MetricsTabProps) => (
  <TabsContent value="metrics" className="space-y-4">
    <MetricsCharts
      metrics={metrics}
      replicaOptions={replicaOptions}
      metricsFrom={metricsFrom}
      metricsTo={metricsTo}
      metricsToNow={metricsToNow}
      variant={variant}
      onTimeRangeChange={onTimeRangeChange}
      onRefresh={onRefresh}
    />
  </TabsContent>
);
