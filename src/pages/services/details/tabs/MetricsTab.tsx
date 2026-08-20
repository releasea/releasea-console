import { TabsContent } from '@/components/ui/tabs';
import MetricsCharts from '@/components/metrics/MetricsCharts';
import type { Metrics } from '@/types/releasea';
import { ServiceTabHeader } from '../ServiceTabHeader';

type MetricsTabProps = {
  metrics: Metrics | null;
  replicaOptions: string[];
  metricsFrom: Date;
  metricsTo: Date;
  metricsToNow: boolean;
  variant?: 'microservice' | 'static-site';
  viewEnvLabel: string;
  onTimeRangeChange: (from: Date, to: Date, toNow?: boolean) => void;
  onRefresh: () => Promise<void>;
  liveUpdatesEnabled?: boolean;
};

export const MetricsTab = ({
  metrics,
  replicaOptions,
  metricsFrom,
  metricsTo,
  metricsToNow,
  variant = 'microservice',
  viewEnvLabel,
  onTimeRangeChange,
  onRefresh,
  liveUpdatesEnabled = true,
}: MetricsTabProps) => (
  <TabsContent value="metrics" className="space-y-4">
    <ServiceTabHeader
      title="Metrics"
      description="Analyze service-level telemetry returned by Prometheus. Values are aggregated across running instances."
      environment={viewEnvLabel}
    />
    <MetricsCharts
      metrics={metrics}
      replicaOptions={replicaOptions}
      metricsFrom={metricsFrom}
      metricsTo={metricsTo}
      metricsToNow={metricsToNow}
      variant={variant}
      onTimeRangeChange={onTimeRangeChange}
      onRefresh={onRefresh}
      autoRefreshEnabled={liveUpdatesEnabled}
    />
  </TabsContent>
);
