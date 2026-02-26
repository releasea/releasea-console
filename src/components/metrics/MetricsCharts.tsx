import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { format } from 'date-fns';
import { Cpu, HardDrive, Timer, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateTimeRangePicker } from '@/components/ui/date-time-range-picker';
import { usePlatformPreferences } from '@/contexts/PlatformPreferencesContext';
import type { Metrics } from '@/types/releasea';

interface MetricsChartsProps {
  metrics: Metrics | null;
  replicaOptions: string[];
  metricsFrom: Date;
  metricsTo: Date;
  metricsToNow?: boolean;
  variant?: 'microservice' | 'static-site';
  onTimeRangeChange: (from: Date, to: Date, toNow?: boolean) => void;
  onRefresh?: () => void | Promise<void>;
}

interface SeriesInfo {
  name: string;
  key: string;
  index: number;
}

const METRIC_COLORS = {
  cpu: '--success',
  memory: '--info',
  latency: '--warning',
  requests: '--primary',
} as const;

const SERIES_STROKE_PATTERNS = ['', '6 3', '2 3', '10 3 2 3', '1 3'];

const RELATIVE_RANGE_OPTIONS = [
  { value: '15m', label: 'Last 15m', windowMs: 15 * 60 * 1000 },
  { value: '30m', label: 'Last 30m', windowMs: 30 * 60 * 1000 },
  { value: '1h', label: 'Last 1h', windowMs: 60 * 60 * 1000 },
  { value: '6h', label: 'Last 6h', windowMs: 6 * 60 * 60 * 1000 },
  { value: '24h', label: 'Last 24h', windowMs: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7d', windowMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

type RelativeRangeValue = (typeof RELATIVE_RANGE_OPTIONS)[number]['value'] | 'custom';

const resolveRelativeRangeValue = (windowMs: number, toNow: boolean): RelativeRangeValue => {
  if (!toNow) {
    return 'custom';
  }
  const matched = RELATIVE_RANGE_OPTIONS.find((option) => Math.abs(option.windowMs - windowMs) <= 30_000);
  return matched?.value ?? '15m';
};

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const MetricsCharts = ({
  metrics,
  replicaOptions,
  metricsFrom,
  metricsTo,
  metricsToNow = false,
  variant = 'microservice',
  onTimeRangeChange,
  onRefresh,
}: MetricsChartsProps) => {
  const { preferences } = usePlatformPreferences();
  const isStaticSite = variant === 'static-site';
  const [selectedReplica, setSelectedReplica] = useState<'all' | string>('all');
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const onRefreshRef = useRef(onRefresh);
  const refreshInFlightRef = useRef(false);
  const hasRefreshHandler = Boolean(onRefresh);
  const fallbackReplicaLabel = isStaticSite ? 'traffic' : 'service';
  const resolvedReplicaOptions = replicaOptions.length > 0 ? replicaOptions : [fallbackReplicaLabel];
  const selectedWindowMs = Math.max(60_000, metricsTo.getTime() - metricsFrom.getTime());
  const [relativeRangeValue, setRelativeRangeValue] = useState<RelativeRangeValue>(() =>
    resolveRelativeRangeValue(selectedWindowMs, metricsToNow),
  );

  useEffect(() => {
    setRelativeRangeValue(resolveRelativeRangeValue(selectedWindowMs, metricsToNow));
  }, [metricsToNow, selectedWindowMs]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const triggerRefresh = useCallback(async () => {
    const refresh = onRefreshRef.current;
    if (!refresh || refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;
    try {
      await Promise.resolve(refresh());
      setLastRefresh(new Date());
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!preferences.autoRefreshMetrics || !hasRefreshHandler) {
      return;
    }

    const interval = window.setInterval(() => {
      void triggerRefresh();
    }, preferences.metricsRefreshInterval * 1000);

    return () => window.clearInterval(interval);
  }, [hasRefreshHandler, preferences.autoRefreshMetrics, preferences.metricsRefreshInterval, triggerRefresh]);

  const handleManualRefresh = useCallback(() => {
    void triggerRefresh();
  }, [triggerRefresh]);

  const handleRelativeRangeChange = useCallback((value: string) => {
    const nextValue = value as RelativeRangeValue;
    setRelativeRangeValue(nextValue);
    if (nextValue === 'custom') {
      onTimeRangeChange(metricsFrom, metricsTo, false);
      return;
    }

    const now = new Date();
    const windowMs = RELATIVE_RANGE_OPTIONS.find((option) => option.value === nextValue)?.windowMs ?? selectedWindowMs;
    onTimeRangeChange(new Date(now.getTime() - windowMs), now, true);
  }, [metricsFrom, metricsTo, onTimeRangeChange, selectedWindowMs]);

  const replicaSeries: SeriesInfo[] = resolvedReplicaOptions.map((name, index) => ({
    name,
    key: `replica_${index + 1}`,
    index,
  }));

  const metricsForReplicaIndex = (replicaIndex: number) => {
    if (!metrics) return null;
    const scaleSeries = (values: number[], factor: number, clampTo100 = false) =>
      values.map((value) => {
        const scaled = value * factor;
        if (!clampTo100) return Number(scaled.toFixed(1));
        return Math.max(0, Math.min(100, Math.round(scaled)));
      });
    const shouldScale = resolvedReplicaOptions.length > 1 && !isStaticSite;
    const factor = shouldScale ? 1 + (replicaIndex + 1) * 0.04 : 1;
    return {
      ...metrics,
      cpu: scaleSeries(metrics.cpu, factor, true),
      memory: scaleSeries(metrics.memory, factor * 0.98, true),
      latencyP95: scaleSeries(metrics.latencyP95, factor * 1.05),
      requests: scaleSeries(metrics.requests, factor * 1.08),
    };
  };

  const activeSeries = selectedReplica === 'all'
    ? replicaSeries
    : replicaSeries.filter((series) => series.name === selectedReplica);
    
  const isSeriesSelectable = selectedReplica === 'all';
  
  const effectiveHiddenSeries = isSeriesSelectable
    ? hiddenSeries.filter((key) => activeSeries.some((series) => series.key === key))
    : [];
    
  const visibleSeries = isSeriesSelectable
    ? activeSeries.filter((series) => !effectiveHiddenSeries.includes(series.key))
    : activeSeries;

  const activeMetricsSources = activeSeries.map((series) => ({
    ...series,
    metrics: metricsForReplicaIndex(series.index),
  }));

  const selectedMetricsSource = selectedReplica === 'all'
    ? metrics
    : activeMetricsSources[0]?.metrics ?? null;

  const metricsData = useMemo(() => {
    if (!metrics?.timestamps) return [];
    return metrics.timestamps.map((ts, i) => {
      const timestamp = new Date(ts).getTime();
      const row: Record<string, number | string> = { timestamp };
      activeMetricsSources.forEach((series) => {
        if (!series.metrics) return;
        row[`cpu_${series.key}`] = series.metrics.cpu[i];
        row[`memory_${series.key}`] = series.metrics.memory[i];
        row[`latency_${series.key}`] = series.metrics.latencyP95[i];
        row[`requests_${series.key}`] = series.metrics.requests[i];
      });
      return row;
    });
  }, [metrics, activeMetricsSources]);

  const statusCodeData = useMemo(() => {
    if (!metrics?.timestamps?.length) {
      return [];
    }
    const statusCodes = metrics.statusCodes;
    if (statusCodes) {
      return metrics.timestamps.map((ts, index) => ({
        timestamp: new Date(ts).getTime(),
        '2xx': statusCodes['2xx']?.[index] ?? 0,
        '4xx': statusCodes['4xx']?.[index] ?? 0,
        '5xx': statusCodes['5xx']?.[index] ?? 0,
      }));
    }
    return metrics.timestamps.map((ts) => ({
      timestamp: new Date(ts).getTime(),
      '2xx': 0,
      '4xx': 0,
      '5xx': 0,
    }));
  }, [metrics]);

  const statusPresence = useMemo(() => {
    if (!statusCodeData.length) {
      return { has2xx: false, has4xx: false, has5xx: false };
    }
    return {
      has2xx: statusCodeData.some((row) => row['2xx'] > 0),
      has4xx: statusCodeData.some((row) => row['4xx'] > 0),
      has5xx: statusCodeData.some((row) => row['5xx'] > 0),
    };
  }, [statusCodeData]);

  const statusSeriesOrder = useMemo(() => {
    const totals = { '2xx': 0, '4xx': 0, '5xx': 0 };
    statusCodeData.forEach((row) => {
      totals['2xx'] += row['2xx'];
      totals['4xx'] += row['4xx'];
      totals['5xx'] += row['5xx'];
    });
    const baseOrder: Array<'2xx' | '4xx' | '5xx'> = ['2xx', '4xx', '5xx'];
    return [...baseOrder].sort((a, b) => {
      const diff = totals[a] - totals[b];
      if (diff !== 0) return diff;
      return baseOrder.indexOf(a) - baseOrder.indexOf(b);
    });
  }, [statusCodeData]);

  const statusSeriesConfig = {
    '2xx': {
      label: '2xx Success',
      color: '--success',
      fillAlpha: 0.08,
      shouldRender: statusPresence.has2xx,
    },
    '4xx': {
      label: '4xx Client',
      color: '--warning',
      fillAlpha: 0.08,
      shouldRender: statusPresence.has4xx,
    },
    '5xx': {
      label: '5xx Server',
      color: '--destructive',
      fillAlpha: 0.08,
      shouldRender: true,
    },
  } as const;

  const resolveSeriesDasharray = (seriesIndex: number) => {
    const pattern = SERIES_STROKE_PATTERNS[seriesIndex % SERIES_STROKE_PATTERNS.length];
    return pattern.length > 0 ? pattern : undefined;
  };

  const resolveSeriesOpacity = (seriesIndex: number) => {
    if (selectedReplica !== 'all' || activeSeries.length <= 1) {
      return 1;
    }
    return Math.max(0.55, 1 - seriesIndex * 0.12);
  };

  const toggleSeriesVisibility = (seriesKey: string) => {
    if (selectedReplica !== 'all') return;
    setHiddenSeries((prev) => {
      const isHidden = prev.includes(seriesKey);
      if (!isHidden && activeSeries.length - prev.length <= 1) return prev;
      return isHidden ? prev.filter((key) => key !== seriesKey) : [...prev, seriesKey];
    });
  };

  // Chart interaction handlers
  const xDomain: [number, number] = metricsToNow
    ? [Date.now() - selectedWindowMs, Date.now()]
    : [metricsFrom.getTime(), metricsTo.getTime()];

  const formatTick = (value: number | string) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return '';
    return format(new Date(numeric), 'HH:mm');
  };

  const formatTooltipLabel = (value: number | string) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return '';
    return format(new Date(numeric), 'MMM dd, HH:mm');
  };

  const chartTooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '12px',
  };

  const formatStatusValue = (value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) return '0';
    const formatted = Number(value).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  };

  const renderStatusTooltip = (props: TooltipProps<number, string>) => {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    const values = new Map<string, number>();
    payload.forEach((entry) => {
      const key = String(entry.dataKey ?? entry.name);
      if (typeof entry.value === 'number') {
        values.set(key, entry.value);
      }
    });
    const labelText = label !== undefined ? formatTooltipLabel(label) : '';
    const order: Array<'2xx' | '4xx' | '5xx'> = ['2xx', '4xx', '5xx'];
    return (
      <div style={chartTooltipStyle} className="px-3 py-2">
        <div className="text-xs text-muted-foreground">{labelText}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {order.map((key) => {
            const config = statusSeriesConfig[key];
            return (
              <div key={key} className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: `hsl(var(${config.color}))` }}
                />
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-medium text-foreground">{formatStatusValue(values.get(key))}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Summary stats
  const cpuAvg = selectedMetricsSource?.cpu?.length ? Math.round(average(selectedMetricsSource.cpu)) : null;
  const cpuPeak = selectedMetricsSource?.cpu?.length ? Math.round(Math.max(...selectedMetricsSource.cpu)) : null;
  const memoryAvg = selectedMetricsSource?.memory?.length ? Math.round(average(selectedMetricsSource.memory)) : null;
  const memoryPeak = selectedMetricsSource?.memory?.length ? Math.round(Math.max(...selectedMetricsSource.memory)) : null;
  const latencyAvg = selectedMetricsSource?.latencyP95?.length
    ? Number(average(selectedMetricsSource.latencyP95).toFixed(1))
    : null;
  const latencyPeak = selectedMetricsSource?.latencyP95?.length
    ? Number(Math.max(...selectedMetricsSource.latencyP95).toFixed(1))
    : null;
  const requestsAvg = selectedMetricsSource?.requests?.length
    ? Math.round(average(selectedMetricsSource.requests))
    : null;
  const requestsPeak = selectedMetricsSource?.requests?.length
    ? Math.round(Math.max(...selectedMetricsSource.requests))
    : null;
  const formatRequests = (value: number | null) => {
    if (value === null) return '--';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${value}`;
  };

  const renderSeriesLegend = () => (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeSeries.map((series) => {
        const isHidden = effectiveHiddenSeries.includes(series.key);
        const dasharray = resolveSeriesDasharray(series.index);
        const opacity = resolveSeriesOpacity(series.index);
        return (
          <button
            key={series.key}
            type="button"
            onClick={() => toggleSeriesVisibility(series.key)}
            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-all ${
              isHidden
                ? 'border-border/50 text-muted-foreground/60 line-through opacity-60'
                : 'border-border text-foreground hover:bg-muted/50'
            }`}
          >
            <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden="true">
              <line
                x1="1"
                y1="3"
                x2="17"
                y2="3"
                stroke="hsl(var(--foreground))"
                strokeOpacity={opacity}
                strokeWidth="2"
                strokeDasharray={dasharray}
                strokeLinecap="round"
              />
            </svg>
            {series.name}
          </button>
        );
      })}
    </div>
  );

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subValue,
    color,
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    color: string;
  }) => (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `hsl(var(${color}) / 0.1)` }}
      >
        <Icon className="h-4 w-4" style={{ color: `hsl(var(${color}))` }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold text-foreground">{value}</p>
        {subValue && (
          <p className="text-[10px] text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );

  const ChartCard = ({
    title,
    children,
    height = 'h-44',
  }: {
    title: string;
    children: React.ReactNode;
    height?: string;
  }) => (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <h3 className="text-xs font-medium text-foreground">{title}</h3>
      </div>
      <div className={height}>
        {children}
      </div>
    </div>
  );

  // Detect if all metric values are zero (likely no data from Prometheus)
  const hasRealData = metrics && (
    metrics.cpu.some(v => v !== 0) ||
    metrics.memory.some(v => v !== 0) ||
    metrics.latencyP95.some(v => v !== 0) ||
    metrics.requests.some(v => v !== 0)
  );

  const diagnostics = metrics?.diagnostics;

  return (
    <div className="space-y-4">
      {/* Diagnostics banner when no real data */}
      {metrics && !hasRealData && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">No metrics data available</p>
              <p className="text-muted-foreground">
                Metrics are not available for this service and environment yet.
                Please try again later.
              </p>
              {diagnostics?.error && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Metrics collection is temporarily unavailable.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats Row */}
      {isStaticSite ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Zap}
            label="Requests/min (avg)"
            value={formatRequests(requestsAvg)}
            subValue={requestsPeak !== null ? `Peak: ${formatRequests(requestsPeak)}` : undefined}
            color="--primary"
          />
          <StatCard
            icon={Timer}
            label="Latency p95 (avg)"
            value={latencyAvg === null ? '--' : `${latencyAvg} ms`}
            subValue={latencyPeak !== null ? `Peak: ${latencyPeak} ms` : undefined}
            color="--warning"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Cpu}
            label="CPU Usage (avg)"
            value={cpuAvg === null ? '--' : `${cpuAvg}%`}
            subValue={cpuPeak !== null ? `Peak: ${cpuPeak}%` : undefined}
            color="--success"
          />
          <StatCard
            icon={HardDrive}
            label="Memory Usage (avg)"
            value={memoryAvg === null ? '--' : `${memoryAvg}%`}
            subValue={memoryPeak !== null ? `Peak: ${memoryPeak}%` : undefined}
            color="--info"
          />
          <StatCard
            icon={Timer}
            label="Latency p95 (avg)"
            value={latencyAvg === null ? '--' : `${latencyAvg} ms`}
            color="--warning"
          />
          <StatCard
            icon={Zap}
            label="Requests/min (avg)"
            value={formatRequests(requestsAvg)}
            color="--primary"
          />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {preferences.autoRefreshMetrics && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
              </span>
              <span>Auto-refresh {preferences.metricsRefreshInterval}s</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleManualRefresh}
              title={`Last refresh: ${format(lastRefresh, 'HH:mm:ss')}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {isSeriesSelectable && activeSeries.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs px-2">
                  Series
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {visibleSeries.length}/{activeSeries.length}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3">
                <p className="text-xs font-medium text-foreground mb-2">Toggle series visibility</p>
                <div className="max-h-40 overflow-y-auto">
                  {renderSeriesLegend()}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {resolvedReplicaOptions.length > 1 && (
            <Select value={selectedReplica} onValueChange={setSelectedReplica}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] bg-card text-xs">
                <SelectValue placeholder="All replicas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All replicas</SelectItem>
                {resolvedReplicaOptions.map((replicaName) => (
                  <SelectItem key={replicaName} value={replicaName}>
                    {replicaName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={relativeRangeValue} onValueChange={handleRelativeRangeChange}>
            <SelectTrigger className="h-7 w-auto min-w-[132px] bg-card text-xs">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              {RELATIVE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {relativeRangeValue === 'custom' && (
            <DateTimeRangePicker
              variant="popover"
              showManualInputs={false}
              showQuickRanges={false}
              value={{ from: metricsFrom, to: metricsTo }}
              onChange={({ from, to }) => {
                setRelativeRangeValue('custom');
                onTimeRangeChange(from, to, false);
              }}
              className="h-7 text-xs"
            />
          )}
          {metricsToNow && (
            <Badge variant="secondary" className="h-7 px-2 text-[10px]">
              Sliding window
            </Badge>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!isStaticSite && (
          <>
            {/* CPU Chart */}
            <ChartCard title="CPU Usage (%)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metricsData}
                  margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={xDomain}
                    tickFormatter={formatTick}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={6}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={40}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={formatTooltipLabel}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                  {visibleSeries.map((series) => {
                    return (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={`cpu_${series.key}`}
                        name={series.name}
                        stroke={`hsl(var(${METRIC_COLORS.cpu}))`}
                        strokeDasharray={resolveSeriesDasharray(series.index)}
                        strokeOpacity={resolveSeriesOpacity(series.index)}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dot={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Memory Chart */}
            <ChartCard title="Memory Usage (%)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metricsData}
                  margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={xDomain}
                    tickFormatter={formatTick}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={6}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={40}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={formatTooltipLabel}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                  {visibleSeries.map((series) => {
                    return (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={`memory_${series.key}`}
                        name={series.name}
                        stroke={`hsl(var(${METRIC_COLORS.memory}))`}
                        strokeDasharray={resolveSeriesDasharray(series.index)}
                        strokeOpacity={resolveSeriesOpacity(series.index)}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dot={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {/* Requests Chart */}
        <ChartCard title="Requests/min">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={metricsData}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={xDomain}
                tickFormatter={formatTick}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickMargin={6}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                width={40}
                tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={formatTooltipLabel}
              />
              {visibleSeries.map((series) => {
                return (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={`requests_${series.key}`}
                    name={series.name}
                    stroke={`hsl(var(${METRIC_COLORS.requests}))`}
                    strokeDasharray={resolveSeriesDasharray(series.index)}
                    strokeOpacity={resolveSeriesOpacity(series.index)}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Latency Chart */}
        <ChartCard title="Latency p95 (ms)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={metricsData}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={xDomain}
                tickFormatter={formatTick}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickMargin={6}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                width={36}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={formatTooltipLabel}
                formatter={(value, name) => [`${value} ms`, name]}
              />
              {visibleSeries.map((series) => {
                return (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={`latency_${series.key}`}
                    name={series.name}
                    stroke={`hsl(var(${METRIC_COLORS.latency}))`}
                    strokeDasharray={resolveSeriesDasharray(series.index)}
                    strokeOpacity={resolveSeriesOpacity(series.index)}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status Code Distribution - Full Width */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-4 py-2.5">
              <h3 className="text-xs font-medium text-foreground">HTTP Status Codes</h3>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className={`inline-flex items-center gap-1 ${statusPresence.has2xx ? '' : 'opacity-40'}`}>
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
                  2xx success
                </span>
                <span className={`inline-flex items-center gap-1 ${statusPresence.has4xx ? '' : 'opacity-40'}`}>
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
                  4xx client
                </span>
                <span className={`inline-flex items-center gap-1 ${statusPresence.has5xx ? '' : 'opacity-40'}`}>
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--destructive))]" />
                  5xx server
                </span>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={statusCodeData}
                  margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={xDomain}
                    tickFormatter={formatTick}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={6}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={40}
                    tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`)}
                  />
                  <Tooltip content={renderStatusTooltip} />
                  {statusSeriesOrder
                    .filter((key) => statusSeriesConfig[key].shouldRender)
                    .map((key) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={`hsl(var(${statusSeriesConfig[key].color}))`}
                        fill={`hsl(var(${statusSeriesConfig[key].color}) / ${statusSeriesConfig[key].fillAlpha})`}
                        strokeWidth={2.4}
                        strokeOpacity={0.95}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dot={false}
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsCharts;
