import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Layers, Server, ShieldAlert, Users, Zap } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBackLink } from '@/components/layout/PageBackLink';
import { QuickStatsGrid } from '@/components/layout/QuickStatsGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  fetchWorkerPools,
  fetchWorkerRegistrations,
  fetchWorkers,
  setWorkerPoolDrain,
  setWorkerPoolMaintenance,
} from '@/lib/data';
import { getEnvironmentLabel } from '@/lib/environments';
import type { Worker, WorkerPool, WorkerRegistration } from '@/types/releasea';

const formatDate = (value?: string) => {
  if (!value) return 'No heartbeat yet';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : format(parsed, 'MMM dd, yyyy HH:mm');
};

const normalizedTags = (tags: string[]) => [...tags].map((tag) => tag.trim()).filter(Boolean).sort();

const belongsToPool = (
  resource: Pick<Worker, 'environment' | 'cluster' | 'namespacePrefix' | 'tags'> | WorkerRegistration,
  pool: WorkerPool,
) => {
  const resourceTags = normalizedTags(resource.tags);
  const poolTags = normalizedTags(pool.tags);
  return resource.environment === pool.environment
    && resource.cluster === pool.cluster
    && resource.namespacePrefix === pool.namespacePrefix
    && resourceTags.length === poolTags.length
    && resourceTags.every((tag, index) => tag === poolTags[index]);
};

const capacityLabel = (state: WorkerPool['capacityState']) => {
  const labels: Record<string, string> = {
    ready: 'Ready', constrained: 'Constrained', degraded: 'Degraded', bootstrap: 'Bootstrap',
    maintenance: 'Maintenance', draining: 'Draining', unavailable: 'Unavailable',
  };
  return labels[state] ?? state;
};

const saturationLabel = (state: WorkerPool['saturationState']) => {
  const labels: Record<string, string> = {
    idle: 'Idle', active: 'Active', hot: 'Hot', saturated: 'Saturated', draining: 'Draining',
    maintenance: 'Maintenance', unavailable: 'Unavailable',
  };
  return labels[state] ?? state;
};

const saturationColor = (state: WorkerPool['saturationState']) => {
  if (state === 'saturated') return 'bg-destructive';
  if (state === 'hot' || state === 'draining') return 'bg-warning';
  if (state === 'active') return 'bg-info';
  if (state === 'unavailable') return 'bg-muted';
  return 'bg-success';
};

export default function WorkerPoolDetailsPage() {
  const { id = '' } = useParams();
  const [pool, setPool] = useState<WorkerPool | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [registrations, setRegistrations] = useState<WorkerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [drainReason, setDrainReason] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [savingDrain, setSavingDrain] = useState(false);

  const load = useCallback(async () => {
    const [poolsData, workersData, registrationsData] = await Promise.all([
      fetchWorkerPools(),
      fetchWorkers(),
      fetchWorkerRegistrations(),
    ]);
    const match = poolsData.find((item) => item.id === id) ?? null;
    setPool(match);
    setWorkers(workersData);
    setRegistrations(registrationsData);
    setMaintenanceReason(match?.maintenanceReason ?? '');
    setDrainReason(match?.drainReason ?? '');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const poolWorkers = useMemo(
    () => (pool ? workers.filter((worker) => belongsToPool(worker, pool)) : []),
    [pool, workers],
  );
  const poolRegistrations = useMemo(() => {
    if (!pool) return [];
    const linkedRegistrationIds = new Set(
      poolWorkers.flatMap((worker) => [worker.credentialId, ...(worker.credentialIds ?? [])]).filter(Boolean),
    );
    return registrations.filter(
      (registration) => linkedRegistrationIds.has(registration.id) || belongsToPool(registration, pool),
    );
  }, [pool, poolWorkers, registrations]);

  if (loading) {
    return <AppLayout><div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading worker pool…</div></AppLayout>;
  }

  if (!pool) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl space-y-6">
          <PageBackLink to="/workers" label="Back to workers" />
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <h1 className="text-lg font-semibold text-foreground">Worker pool not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">The pool may no longer have active workers or registrations.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const updateMaintenance = async () => {
    const enabled = !pool.maintenanceEnabled;
    if (enabled && !maintenanceReason.trim()) {
      toast({ title: 'Maintenance reason required', description: 'Explain why this pool must leave routing.', variant: 'destructive' });
      return;
    }
    setSavingMaintenance(true);
    try {
      const ok = await setWorkerPoolMaintenance(pool.id, { enabled, reason: enabled ? maintenanceReason.trim() : '' });
      if (!ok) throw new Error('Unable to update maintenance mode.');
      await load();
      toast({ title: enabled ? 'Maintenance enabled' : 'Maintenance disabled', description: enabled ? 'The pool is excluded from new routing decisions.' : 'The pool is eligible for routing again.' });
    } catch (error) {
      toast({ title: 'Maintenance update failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' });
    } finally {
      setSavingMaintenance(false);
    }
  };

  const updateDrain = async () => {
    const enabled = !pool.drainEnabled;
    if (enabled && !drainReason.trim()) {
      toast({ title: 'Drain reason required', description: 'Explain why this pool should stop claiming new work.', variant: 'destructive' });
      return;
    }
    setSavingDrain(true);
    try {
      const ok = await setWorkerPoolDrain(pool.id, { enabled, reason: enabled ? drainReason.trim() : '' });
      if (!ok) throw new Error('Unable to update drain mode.');
      await load();
      toast({ title: enabled ? 'Drain enabled' : 'Drain disabled', description: enabled ? 'In-flight work can finish, but no new operations will be claimed.' : 'The pool can claim new operations again.' });
    } catch (error) {
      toast({ title: 'Drain update failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' });
    } finally {
      setSavingDrain(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <PageBackLink to="/workers" label="Back to workers" />

        <div className="space-y-4 border-b border-border pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{pool.cluster || 'Unassigned cluster'}</h1>
                <StatusBadge status={pool.status} className="normal-case" />
                {pool.maintenanceEnabled ? <Badge variant="destructive">Maintenance</Badge> : null}
                {pool.drainEnabled ? <Badge variant="outline" className="border-warning/60 text-warning">Draining</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Capacity, routing controls, workers, and registrations for this execution pool.</p>
            </div>
            <Badge variant="outline" className="w-fit font-normal">Last heartbeat {formatDate(pool.lastHeartbeat)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{getEnvironmentLabel(pool.environment)}</Badge>
            <Badge variant="secondary" className="font-mono">{pool.namespacePrefix}</Badge>
            {pool.tags.length > 0 ? pool.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <Badge variant="secondary">No tags</Badge>}
          </div>
        </div>

        <QuickStatsGrid
          stats={[
            { label: 'Connected workers', value: `${pool.onlineWorkers + pool.busyWorkers}/${pool.workerCount}`, icon: <Server className="h-4 w-4 text-success" /> },
            { label: 'Available instances', value: pool.availableAgents.toString(), sublabel: `${pool.onlineAgents} ready · ${pool.desiredAgents} desired`, icon: <Zap className="h-4 w-4 text-warning" /> },
            { label: 'Capacity score', value: `${pool.capacityScore}/100`, sublabel: capacityLabel(pool.capacityState), icon: <Activity className="h-4 w-4 text-info" /> },
            { label: 'Registrations', value: `${pool.activeRegistrations}/${pool.registrationCount}`, sublabel: 'active / total', icon: <Users className="h-4 w-4 text-primary" /> },
          ]}
        />

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Pool saturation</h2>
              <p className="mt-1 text-sm text-muted-foreground">Current agent utilization across this pool.</p>
            </div>
            <span className="text-sm font-medium text-foreground">{saturationLabel(pool.saturationState)} · {pool.saturationPercent}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${saturationColor(pool.saturationState)}`} style={{ width: `${pool.saturationPercent}%` }} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Maintenance mode</h2>
                <p className="mt-1 text-sm text-muted-foreground">Exclude the pool from routing and fallback selection.</p>
              </div>
            </div>
            {pool.maintenanceEnabled ? (
              <div className="mt-5 rounded-md border border-border bg-muted/20 p-4 text-sm">
                <p className="font-medium text-foreground">Maintenance is active</p>
                <p className="mt-1 text-muted-foreground">{pool.maintenanceReason || 'No reason recorded'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(pool.maintenanceUpdatedAt)}{pool.maintenanceUpdatedBy ? ` by ${pool.maintenanceUpdatedBy}` : ''}</p>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                <Label htmlFor="maintenance-reason">Reason</Label>
                <Textarea id="maintenance-reason" value={maintenanceReason} onChange={(event) => setMaintenanceReason(event.target.value)} rows={3} placeholder="Planned cluster maintenance or capacity isolation…" />
              </div>
            )}
            <Button className="mt-4" variant={pool.maintenanceEnabled ? 'outline' : 'default'} onClick={updateMaintenance} disabled={savingMaintenance}>
              {savingMaintenance ? 'Updating…' : pool.maintenanceEnabled ? 'Disable maintenance' : 'Enable maintenance'}
            </Button>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Layers className="mt-0.5 h-5 w-5 text-info" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Drain mode</h2>
                <p className="mt-1 text-sm text-muted-foreground">Finish in-flight work while preventing new operation claims.</p>
              </div>
            </div>
            {pool.drainEnabled ? (
              <div className="mt-5 rounded-md border border-border bg-muted/20 p-4 text-sm">
                <p className="font-medium text-foreground">Drain is active</p>
                <p className="mt-1 text-muted-foreground">{pool.drainReason || 'No reason recorded'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(pool.drainUpdatedAt)}{pool.drainUpdatedBy ? ` by ${pool.drainUpdatedBy}` : ''}</p>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                <Label htmlFor="drain-reason">Reason</Label>
                <Textarea id="drain-reason" value={drainReason} onChange={(event) => setDrainReason(event.target.value)} rows={3} placeholder="Scale down this cluster or migrate work elsewhere…" />
              </div>
            )}
            {pool.maintenanceEnabled ? <p className="mt-3 text-xs text-muted-foreground">Disable maintenance before changing drain mode.</p> : null}
            <Button className="mt-4" variant={pool.drainEnabled ? 'outline' : 'default'} onClick={updateDrain} disabled={pool.maintenanceEnabled || savingDrain}>
              {savingDrain ? 'Updating…' : pool.drainEnabled ? 'Disable drain' : 'Enable drain'}
            </Button>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Workers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live workers that currently form this pool.</p>
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {poolWorkers.length > 0 ? poolWorkers.map((worker) => (
                <Link key={worker.id} to={`/workers/${encodeURIComponent(worker.id)}`} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30">
                  <div><p className="font-mono text-sm font-medium text-foreground">{worker.name}</p><p className="mt-1 text-xs text-muted-foreground">{worker.namespace} · {worker.onlineAgents}/{worker.desiredAgents} instances ready</p></div>
                  <StatusBadge status={worker.status} className="normal-case" />
                </Link>
              )) : <p className="p-4 text-sm text-muted-foreground">No live workers currently match this pool.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Registrations</h2>
            <p className="mt-1 text-sm text-muted-foreground">Installation registrations associated with this pool.</p>
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {poolRegistrations.length > 0 ? poolRegistrations.map((registration) => (
                <div key={registration.id} className="flex items-center justify-between gap-3 p-4">
                  <div><p className="font-mono text-sm font-medium text-foreground">{registration.name}</p><p className="mt-1 text-xs text-muted-foreground">{registration.namespace || 'Namespace not reported'}</p></div>
                  <Badge variant="outline">{registration.status}</Badge>
                </div>
              )) : <p className="p-4 text-sm text-muted-foreground">No registrations currently match this pool.</p>}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
