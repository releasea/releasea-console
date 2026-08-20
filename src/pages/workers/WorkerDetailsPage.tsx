import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Cpu, KeyRound, Layers, RefreshCw, Rocket, Save, Server, Settings2, ShieldAlert, Zap } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBackLink } from '@/components/layout/PageBackLink';
import { QuickStatsGrid } from '@/components/layout/QuickStatsGrid';
import { SettingsSection } from '@/components/layout/SettingsSection';
import { DocumentationLink } from '@/components/layout/DocumentationLink';
import { ConfirmActionModal } from '@/components/modals/ConfirmActionModal';
import { DangerZone } from '@/components/service/DangerZone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  deleteWorker,
  fetchWorkerPools,
  fetchWorkerRegistrations,
  fetchWorkers,
  restartWorker,
  setWorkerPoolDrain,
  setWorkerPoolMaintenance,
  updateWorker,
} from '@/lib/data';
import { fetchResourceAuditLogs } from '@/lib/governance-data';
import { getEnvironmentLabel } from '@/lib/environments';
import type { AuditLogEntry } from '@/types/governance';
import type { Worker, WorkerPool, WorkerRegistration } from '@/types/releasea';

type WorkerTab = 'summary' | 'events' | 'pool' | 'settings';
type TimelineItem = { id: string; title: string; description: string; timestamp: string; actor?: string; kind: 'heartbeat' | 'registration' | 'configuration' | 'operation' | 'pool' };

const formatDate = (value?: string) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : format(parsed, 'MMM dd, yyyy HH:mm');
};

const normalizeTags = (tags: string[]) => [...tags].map((tag) => tag.trim()).filter(Boolean).sort();
const workerConnectionLabel = (status: Worker['status']) => {
  if (status === 'online') return 'Connected';
  if (status === 'busy') return 'Connected · busy';
  if (status === 'offline') return 'Disconnected';
  return 'Awaiting connection';
};
const registrationStatusLabel: Record<WorkerRegistration['status'], string> = {
  unused: 'Not used',
  active: 'Active',
  inactive: 'Inactive',
  revoked: 'Revoked',
};
const matchesPool = (resource: Pick<Worker, 'environment' | 'cluster' | 'namespacePrefix' | 'tags'>, pool: WorkerPool) => {
  const resourceTags = normalizeTags(resource.tags);
  const poolTags = normalizeTags(pool.tags);
  return resource.environment === pool.environment
    && resource.cluster === pool.cluster
    && resource.namespacePrefix === pool.namespacePrefix
    && resourceTags.length === poolTags.length
    && resourceTags.every((tag, index) => tag === poolTags[index]);
};

const auditTitle = (action: string) => ({
  'worker.configuration.updated': 'Worker configuration updated',
  'worker.restart.requested': 'Worker restart requested',
  'worker.registration.created': 'Registration created',
  'worker.registration.deleted': 'Registration deleted',
  'worker_pool.maintenance.enabled': 'Pool maintenance enabled',
  'worker_pool.maintenance.disabled': 'Pool maintenance disabled',
  'worker_pool.drain.enabled': 'Pool drain enabled',
  'worker_pool.drain.disabled': 'Pool drain disabled',
}[action] ?? action.split('.').join(' '));

const auditKind = (event: AuditLogEntry): TimelineItem['kind'] => {
  if (event.resourceType === 'worker_pool') return 'pool';
  if (event.resourceType === 'worker_registration') return 'registration';
  if (event.action.includes('restart')) return 'operation';
  return 'configuration';
};

const timelineIcon = (kind: TimelineItem['kind']) => {
  if (kind === 'heartbeat') return <Activity className="h-4 w-4" />;
  if (kind === 'registration') return <KeyRound className="h-4 w-4" />;
  if (kind === 'operation') return <RefreshCw className="h-4 w-4" />;
  if (kind === 'pool') return <Layers className="h-4 w-4" />;
  return <Settings2 className="h-4 w-4" />;
};

export default function WorkerDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: WorkerTab = requestedTab === 'activity' || requestedTab === 'events'
    ? 'events'
    : requestedTab === 'pool' || requestedTab === 'settings'
      ? requestedTab
      : 'summary';
  const [worker, setWorker] = useState<Worker | null>(null);
  const [registration, setRegistration] = useState<WorkerRegistration | null>(null);
  const [pool, setPool] = useState<WorkerPool | null>(null);
  const [poolWorkers, setPoolWorkers] = useState<Worker[]>([]);
  const [audits, setAudits] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [drainReason, setDrainReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingControl, setSavingControl] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [drainOpen, setDrainOpen] = useState(false);

  const load = useCallback(async () => {
    const [workersData, registrationsData, poolsData] = await Promise.all([fetchWorkers(), fetchWorkerRegistrations(), fetchWorkerPools()]);
    const match = workersData.find((item) => item.id === id || item.primaryId === id) ?? null;
    const credentialIds = new Set([match?.credentialId, ...(match?.credentialIds ?? [])].filter(Boolean));
    const linkedRegistration = registrationsData.find((item) => credentialIds.has(item.id)) ?? null;
    const linkedPool = match ? poolsData.find((item) => matchesPool(match, item)) ?? null : null;
    const relatedWorkers = linkedPool ? workersData.filter((item) => matchesPool(item, linkedPool)) : [];

    setWorker(match);
    setRegistration(linkedRegistration);
    setPool(linkedPool);
    setPoolWorkers(relatedWorkers);
    setName(match?.name ?? '');
    setTags(match?.tags.join(', ') ?? '');
    setMaintenanceReason(linkedPool?.maintenanceReason ?? '');
    setDrainReason(linkedPool?.drainReason ?? '');

    if (match) {
      const workerIds = Array.from(new Set([match.id, match.primaryId].filter((value): value is string => Boolean(value))));
      const auditRequests = workerIds.map((resourceId) => fetchResourceAuditLogs('worker', resourceId));
      if (linkedRegistration) auditRequests.push(fetchResourceAuditLogs('worker_registration', linkedRegistration.id));
      if (linkedPool) auditRequests.push(fetchResourceAuditLogs('worker_pool', linkedPool.id));
      const eventGroups = await Promise.all(auditRequests);
      const unique = new Map(eventGroups.flat().map((event) => [event.id, event]));
      setAudits(Array.from(unique.values()));
    } else {
      setAudits([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!worker) return [];
    const items: TimelineItem[] = audits.map((event) => ({
      id: event.id,
      title: auditTitle(event.action),
      description: typeof event.details?.message === 'string' ? event.details.message : `Recorded ${event.action}`,
      timestamp: event.performedAt,
      actor: event.performedBy.name,
      kind: auditKind(event),
    }));
    if (worker.registeredAt) items.push({ id: 'worker-registered', title: 'Worker registered', description: `${worker.name} joined ${worker.cluster}.`, timestamp: worker.registeredAt, kind: 'registration' });
    if (registration?.createdAt) items.push({ id: 'registration-created', title: 'Registration issued', description: `Installation registration ${registration.name} was created.`, timestamp: registration.createdAt, kind: 'registration' });
    if (worker.lastHeartbeat) items.push({ id: 'last-heartbeat', title: 'Latest heartbeat received', description: `${worker.onlineAgents}/${worker.desiredAgents} execution instances ready; worker ${workerConnectionLabel(worker.status).toLowerCase()}.`, timestamp: worker.lastHeartbeat, kind: 'heartbeat' });
    if (pool?.maintenanceUpdatedAt && !items.some((item) => item.timestamp === pool.maintenanceUpdatedAt)) items.push({ id: 'maintenance-update', title: pool.maintenanceEnabled ? 'Pool maintenance enabled' : 'Pool maintenance disabled', description: pool.maintenanceReason || 'Pool maintenance state changed.', timestamp: pool.maintenanceUpdatedAt, actor: pool.maintenanceUpdatedBy, kind: 'pool' });
    if (pool?.drainUpdatedAt && !items.some((item) => item.timestamp === pool.drainUpdatedAt)) items.push({ id: 'drain-update', title: pool.drainEnabled ? 'Pool drain enabled' : 'Pool drain disabled', description: pool.drainReason || 'Pool drain state changed.', timestamp: pool.drainUpdatedAt, actor: pool.drainUpdatedBy, kind: 'pool' });
    return items.filter((item) => !Number.isNaN(Date.parse(item.timestamp))).sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  }, [audits, pool, registration, worker]);

  if (loading) return <AppLayout><div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading worker…</div></AppLayout>;
  if (!worker) return <AppLayout><div className="mx-auto max-w-3xl space-y-6"><PageBackLink to="/workers" label="Back to workers" /><div className="rounded-lg border border-dashed border-border bg-card p-10 text-center"><h1 className="text-lg font-semibold">Worker not found</h1><p className="mt-2 text-sm text-muted-foreground">It may have been removed or has not sent a heartbeat yet.</p></div></div></AppLayout>;

  const actionId = worker.primaryId ?? worker.id;
  const configurationDirty = name.trim() !== worker.name || normalizeTags(tags.split(',')).join(',') !== normalizeTags(worker.tags).join(',');
  const saveConfiguration = async () => {
    const nextName = name.trim();
    const nextTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (!nextName) return;
    setSaving(true);
    try {
      await updateWorker(actionId, { name: nextName, environment: worker.environment, tags: nextTags });
      toast({ title: 'Worker updated', description: 'Name and routing tags were saved.' });
      await load();
    } finally { setSaving(false); }
  };

  const changeMaintenance = async () => {
    if (!pool) return;
    const enabled = !pool.maintenanceEnabled;
    setSavingControl(true);
    try {
      const ok = await setWorkerPoolMaintenance(pool.id, { enabled, reason: enabled ? maintenanceReason.trim() : '' });
      if (!ok) throw new Error('Unable to update pool maintenance mode.');
      toast({ title: enabled ? 'Maintenance enabled' : 'Pool enabled', description: enabled ? 'This pool will not claim new operations.' : 'This pool can participate in routing again.' });
      await load();
    } catch (error) {
      toast({ title: 'Pool update failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' });
    } finally { setSavingControl(false); setMaintenanceOpen(false); }
  };

  const changeDrain = async () => {
    if (!pool) return;
    const enabled = !pool.drainEnabled;
    setSavingControl(true);
    try {
      const ok = await setWorkerPoolDrain(pool.id, { enabled, reason: enabled ? drainReason.trim() : '' });
      if (!ok) throw new Error('Unable to update pool drain mode.');
      toast({ title: enabled ? 'Drain enabled' : 'Drain disabled', description: enabled ? 'In-flight work can finish, but no new work will be claimed.' : 'The pool can claim new operations again.' });
      await load();
    } catch (error) {
      toast({ title: 'Pool update failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' });
    } finally { setSavingControl(false); setDrainOpen(false); }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <PageBackLink to="/workers" label="Back to workers" />
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{worker.name}</h1><StatusBadge status={worker.status} label={workerConnectionLabel(worker.status)} className="normal-case" />{pool?.maintenanceEnabled ? <Badge variant="destructive">Maintenance</Badge> : null}{pool?.drainEnabled ? <Badge variant="outline" className="border-warning/60 text-warning">Draining</Badge> : null}</div>
            <p className="text-sm text-muted-foreground">Operate, inspect, and configure this registered worker.</p>
            <div className="flex flex-wrap gap-2"><Badge variant="outline">{getEnvironmentLabel(worker.environment)}</Badge><Badge variant="secondary" className="font-mono">{worker.cluster}</Badge><Badge variant="outline" className="font-mono">{worker.namespace}</Badge></div>
          </div>
          <DocumentationLink slug="environments-and-workers" label="Worker guide" variant="button" />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setSearchParams(value === 'summary' ? {} : { tab: value })} className="space-y-6">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1">
            <TabsTrigger value="summary" className="gap-2"><Server className="h-4 w-4" />Summary</TabsTrigger>
            <TabsTrigger value="events" className="gap-2"><Rocket className="h-4 w-4" />Events <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{timeline.length}</Badge></TabsTrigger>
            <TabsTrigger value="pool" className="gap-2"><Layers className="h-4 w-4" />Pool & routing</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <QuickStatsGrid stats={[{ label: 'Execution instances', value: `${worker.onlineAgents}/${worker.desiredAgents}`, sublabel: 'ready / desired', icon: <Zap className="h-4 w-4 text-success" /> }, { label: 'Tasks completed', value: worker.tasksCompleted.toString(), icon: <Cpu className="h-4 w-4 text-info" /> }, { label: 'Version', value: worker.version || 'Unknown', icon: <Layers className="h-4 w-4 text-primary" /> }, { label: 'Last heartbeat', value: formatDate(worker.lastHeartbeat), icon: <RefreshCw className="h-4 w-4 text-muted-foreground" /> }]} />
            <div className="grid gap-6 lg:grid-cols-2">
              <SettingsSection title="Runtime identity" description="Where this worker runs and how Releasea reaches it." className="h-full">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Environment', getEnvironmentLabel(worker.environment)], ['Cluster', worker.cluster || 'Not reported'], ['Platform namespace', worker.namespace || 'Not reported'], ['Application namespace prefix', worker.namespacePrefix || 'Not reported']].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
              </SettingsSection>
              <SettingsSection
                title="Operating state"
                description="Current execution and routing state."
                className="h-full"
                actions={pool ? <Button variant="outline" size="sm" onClick={() => setSearchParams({ tab: 'pool' })}>View routing</Button> : undefined}
              >
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Connection</dt><dd className="mt-1"><StatusBadge status={worker.status} label={workerConnectionLabel(worker.status)} /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Pool state</dt><dd className="mt-1 font-medium">{pool?.maintenanceEnabled ? 'Maintenance' : pool?.drainEnabled ? 'Draining' : pool ? 'Enabled' : 'Not assigned'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Current task</dt><dd className="mt-1 break-words font-medium">{worker.currentTask || 'Idle'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Registered</dt><dd className="mt-1 font-medium">{formatDate(worker.registeredAt)}</dd></div>
                </dl>
              </SettingsSection>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div><h2 className="text-base font-semibold">Operational timeline</h2><p className="mt-1 text-sm text-muted-foreground">Registration, heartbeat, configuration, restart, maintenance, and drain events recorded by Releasea.</p></div>
            <div className="rounded-lg border border-border bg-card p-5">
              {timeline.length > 0 ? <ol className="space-y-0">{timeline.map((item, index) => <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0"><div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">{timelineIcon(item.kind)}</div>{index < timeline.length - 1 ? <><span className="absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-border" aria-hidden="true" /><span className="absolute bottom-3 left-12 right-0 h-px bg-border/60" aria-hidden="true" /></> : null}<div className="min-w-0 pt-0.5"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatDate(item.timestamp)}{item.actor ? ` · ${item.actor}` : ''}</p></div></li>)}</ol> : <p className="text-sm text-muted-foreground">No operational events have been recorded for this worker yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="pool" className="space-y-6">
            {!pool ? <div className="rounded-lg border border-dashed p-10 text-center"><h2 className="font-semibold">No capacity pool assigned</h2><p className="mt-2 text-sm text-muted-foreground">A pool appears after matching worker heartbeat data is aggregated.</p></div> : <>
              <QuickStatsGrid stats={[{ label: 'Connected workers', value: `${pool.onlineWorkers + pool.busyWorkers}/${pool.workerCount}`, icon: <Server className="h-4 w-4 text-success" /> }, { label: 'Available instances', value: pool.availableAgents.toString(), sublabel: `${pool.onlineAgents} ready · ${pool.desiredAgents} desired`, icon: <Zap className="h-4 w-4 text-warning" /> }, { label: 'Capacity score', value: `${pool.capacityScore}/100`, icon: <Activity className="h-4 w-4 text-info" /> }, { label: 'Registrations', value: `${pool.activeRegistrations}/${pool.registrationCount}`, sublabel: 'active / total', icon: <KeyRound className="h-4 w-4 text-primary" /> }]} />
              <SettingsSection title="Routing identity" description="Values used to select this pool for operations.">
                <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Pool</dt><dd className="mt-1 font-mono">{pool.cluster}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Namespace prefix</dt><dd className="mt-1 font-mono">{pool.namespacePrefix}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Namespaces</dt><dd className="mt-1 break-words font-mono">{pool.namespaces.join(', ') || 'None discovered'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Routing tags</dt><dd className="mt-2 flex flex-wrap gap-2">{pool.tags.length > 0 ? pool.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <span className="text-muted-foreground">No tags required</span>}</dd></div>
                </dl>
                {poolWorkers.length > 1 ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-medium text-muted-foreground">Other workers in this pool</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {poolWorkers.filter((item) => item.id !== worker.id).map((item) => (
                        <Button key={item.id} type="button" variant="outline" size="sm" onClick={() => navigate(`/workers/${encodeURIComponent(item.id)}`)}>
                          {item.name} · {item.onlineAgents}/{item.desiredAgents} instances
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </SettingsSection>
              <SettingsSection
                title="Pool controls"
                description="Control whether this pool can receive new operations."
              >
                <div className="-m-4 divide-y divide-border">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">Maintenance mode</p>
                          {pool.maintenanceEnabled ? <Badge variant="destructive">Routing paused</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pool.maintenanceEnabled
                            ? pool.maintenanceReason || 'Maintenance is active for every worker in this pool.'
                            : 'Temporarily exclude every worker in this pool from routing.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="shrink-0 gap-2 sm:min-w-40"
                      variant={pool.maintenanceEnabled ? 'outline' : 'destructive'}
                      disabled={savingControl}
                      onClick={() => {
                        if (!pool.maintenanceEnabled) setMaintenanceReason('');
                        setMaintenanceOpen(true);
                      }}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {pool.maintenanceEnabled ? 'Enable pool' : 'Enable maintenance'}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <Layers className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">Drain mode</p>
                          {pool.drainEnabled ? <Badge variant="outline" className="border-warning/60 text-warning">New claims paused</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pool.drainEnabled
                            ? pool.drainReason || 'Drain is active while in-flight work finishes.'
                            : 'Allow in-flight work to finish and prevent new operation claims.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="shrink-0 gap-2 sm:min-w-40"
                      variant="outline"
                      disabled={savingControl || pool.maintenanceEnabled}
                      onClick={() => {
                        if (!pool.drainEnabled) setDrainReason('');
                        setDrainOpen(true);
                      }}
                    >
                      <Layers className="h-4 w-4" />
                      {pool.drainEnabled ? 'Disable drain' : 'Enable drain'}
                    </Button>
                  </div>
                </div>
              </SettingsSection>
            </>}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SettingsSection title="Worker configuration" description="Update its display name and routing tags. Environment and cluster remain immutable."><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="worker-detail-name">Worker name</Label><Input id="worker-detail-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="worker-detail-tags">Routing tags</Label><Input id="worker-detail-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="build, gpu" /><p className="text-xs text-muted-foreground">Separate tags with commas.</p></div></div><div className="mt-4 flex justify-end"><Button className="gap-2" onClick={saveConfiguration} disabled={saving || !name.trim() || !configurationDirty}><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</Button></div></SettingsSection>
            <SettingsSection title="Registration" description="Credential metadata used by this worker to authenticate with Releasea.">{registration ? <dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Registration</dt><dd className="mt-1 font-mono">{registration.name}</dd></div><div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><Badge variant="outline">{registrationStatusLabel[registration.status]}</Badge></dd></div><div><dt className="text-xs text-muted-foreground">Created</dt><dd className="mt-1">{formatDate(registration.createdAt)}</dd></div></dl> : <p className="text-sm text-muted-foreground">No registration metadata is linked to this worker.</p>}</SettingsSection>
            <SettingsSection title="Execution control" description="Restart this worker without changing its registration or routing identity."><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Restart worker</p><p className="text-xs text-muted-foreground">Queues an idempotent Kubernetes restart operation.</p></div><Button variant="outline" className="gap-2" onClick={() => setRestartOpen(true)}><RefreshCw className="h-4 w-4" />Restart worker</Button></div></SettingsSection>
            <DangerZone title="Danger zone" description="Deleting a worker permanently removes its inventory record and linked registrations." actionLabel="Delete worker" actionDescription="This action cannot be undone. Running workloads are not deleted, but this worker can no longer operate them through Releasea." onAction={() => setDeleteOpen(true)} />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmActionModal open={restartOpen} onOpenChange={setRestartOpen} title="Restart worker" description="Releasea will queue a Kubernetes restart for this worker. Existing operation claims remain protected by their leases." confirmLabel="Restart worker" variant="warning" onConfirm={async () => { await restartWorker(actionId); setRestartOpen(false); toast({ title: 'Restart requested', description: `Restart signal sent to "${worker.name}".` }); await load(); }} />
      <ConfirmActionModal
        open={maintenanceOpen}
        onOpenChange={(open) => {
          setMaintenanceOpen(open);
          if (!open && !pool?.maintenanceEnabled) setMaintenanceReason('');
        }}
        title={pool?.maintenanceEnabled ? 'Enable worker pool' : 'Enable maintenance'}
        description={pool?.maintenanceEnabled ? 'All workers in this pool will become eligible to claim new operations again.' : 'Every worker in this pool will stop claiming new operations until maintenance is disabled.'}
        details={pool && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pool <span className="font-mono text-foreground">{pool.cluster} · {pool.namespacePrefix}</span>
            </p>
            {!pool.maintenanceEnabled ? (
              <div className="space-y-2">
                <Label htmlFor="maintenance-modal-reason">Reason for maintenance</Label>
                <Textarea
                  id="maintenance-modal-reason"
                  value={maintenanceReason}
                  onChange={(event) => setMaintenanceReason(event.target.value)}
                  rows={3}
                  placeholder="Describe why this pool must enter maintenance…"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">This reason will be recorded in the worker activity timeline.</p>
              </div>
            ) : pool.maintenanceReason ? (
              <p className="text-sm text-muted-foreground">Current reason: {pool.maintenanceReason}</p>
            ) : null}
          </div>
        )}
        confirmLabel={pool?.maintenanceEnabled ? 'Enable pool' : 'Enable maintenance'}
        confirmDisabled={!pool?.maintenanceEnabled && !maintenanceReason.trim()}
        variant={pool?.maintenanceEnabled ? 'success' : 'warning'}
        onConfirm={changeMaintenance}
      />
      <ConfirmActionModal
        open={drainOpen}
        onOpenChange={(open) => {
          setDrainOpen(open);
          if (!open && !pool?.drainEnabled) setDrainReason('');
        }}
        title={pool?.drainEnabled ? 'Disable drain mode' : 'Enable drain mode'}
        description={pool?.drainEnabled ? 'The pool will be allowed to claim new operations again.' : 'In-flight work may finish, but no new operations will be claimed.'}
        details={pool && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pool <span className="font-mono text-foreground">{pool.cluster} · {pool.namespacePrefix}</span>
            </p>
            {!pool.drainEnabled ? (
              <div className="space-y-2">
                <Label htmlFor="drain-modal-reason">Reason for drain</Label>
                <Textarea
                  id="drain-modal-reason"
                  value={drainReason}
                  onChange={(event) => setDrainReason(event.target.value)}
                  rows={3}
                  placeholder="Describe why this pool must stop receiving new work…"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">This reason will be recorded in the worker activity timeline.</p>
              </div>
            ) : pool.drainReason ? (
              <p className="text-sm text-muted-foreground">Current reason: {pool.drainReason}</p>
            ) : null}
          </div>
        )}
        confirmLabel={pool?.drainEnabled ? 'Disable drain' : 'Enable drain'}
        confirmDisabled={!pool?.drainEnabled && !drainReason.trim()}
        variant="warning"
        onConfirm={changeDrain}
      />
      <ConfirmActionModal open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete worker" description="This removes the worker and revokes its linked registration tokens." confirmPhrase="delete" confirmLabel="Delete worker" variant="destructive" onConfirm={async () => { await deleteWorker(actionId); toast({ title: 'Worker deleted', description: `Worker "${worker.name}" was removed.` }); navigate('/workers'); }} />
    </AppLayout>
  );
}
