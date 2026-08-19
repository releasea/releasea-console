import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Plus, Save, Trash2, Wifi } from 'lucide-react';
import { SettingsSection } from '@/components/layout/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  createAIProvider,
  deleteAIProvider,
  fetchAIProviders,
  fetchAIUsage,
  testAIProvider,
  updateAIProvider,
  type AIProviderInput,
  type AIUsageSummary,
} from '@/lib/data';
import type { AIProvider, AIProviderType } from '@/types/releasea';

const emptyProvider = (): AIProviderInput => ({
  name: '',
  type: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-5.6-luna',
  enabled: true,
  default: false,
  allowPrivateNetwork: false,
  externalEgress: true,
  timeoutSeconds: 45,
  maxInputChars: 60000,
  maxOutputTokens: 1800,
  dailyTokenLimit: 0,
  retentionDays: 30,
  capabilities: [],
  apiKey: '',
});

export function AIProvidersSettings() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AIProviderInput>(emptyProvider);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [usage, setUsage] = useState<AIUsageSummary>({ from: '', providers: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIProvider | null>(null);

  const refresh = useCallback(async () => {
    const [providerData, usageData] = await Promise.all([fetchAIProviders(), fetchAIUsage()]);
    setProviders(Array.isArray(providerData) ? providerData : []);
    setUsage({
      from: usageData?.from ?? '',
      providers: Array.isArray(usageData?.providers) ? usageData.providers : [],
    });
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const edit = (provider: AIProvider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      model: provider.model,
      enabled: provider.enabled,
      default: provider.default,
      allowPrivateNetwork: provider.allowPrivateNetwork,
      externalEgress: provider.externalEgress,
      timeoutSeconds: provider.timeoutSeconds,
      maxInputChars: provider.maxInputChars,
      maxOutputTokens: provider.maxOutputTokens,
      dailyTokenLimit: provider.dailyTokenLimit,
      retentionDays: provider.retentionDays,
      capabilities: provider.capabilities ?? [],
      apiKey: '',
    });
    setFormOpen(true);
  };

  const changeType = (type: AIProviderType) => setForm((current) => ({
    ...current,
    type,
    baseUrl: type === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434/v1',
    model: type === 'openai' ? 'gpt-5.6-luna' : '',
    allowPrivateNetwork: type === 'openai-compatible',
  }));

  const save = async () => {
    setBusy(true);
    const saved = editingId
      ? await updateAIProvider(editingId, form)
      : await createAIProvider(form);
    setBusy(false);
    if (!saved) {
      toast({ title: 'Unable to save provider', description: 'Review the URL, credential, and encryption configuration.', variant: 'destructive' });
      return;
    }
    toast({ title: 'AI provider saved', description: 'Run the connection check before using it for service analysis.' });
    setEditingId(null);
    setForm(emptyProvider());
    setFormOpen(false);
    await refresh();
  };

  const test = async (provider: AIProvider) => {
    setTestingId(provider.id);
    const result = await testAIProvider(provider.id);
    setTestingId(null);
    await refresh();
    toast({
      title: result?.state === 'healthy' ? 'Provider is healthy' : 'Provider check failed',
      description: result?.message ?? 'The provider did not return a health result.',
      variant: result?.state === 'healthy' ? 'default' : 'destructive',
    });
  };

  const remove = async (provider: AIProvider) => {
    if (await deleteAIProvider(provider.id)) {
      setDeleteTarget(null);
      await refresh();
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProvider());
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Operational AI providers"
        description="Connect OpenAI or an OpenAI-compatible local runtime. Releasea sends sanitized, read-only operational evidence and never shares deployment credentials."
        actions={(
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add AI provider
          </Button>
        )}
      >
        <div className="space-y-3">
          {providers.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No AI provider configured. Add one to enable service diagnostics.
            </div>
          )}
          {providers.map((provider) => (
            <div key={provider.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2"><Bot className="h-5 w-5 text-primary" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{provider.name}</p>
                    {provider.default && <Badge>Default</Badge>}
                    <Badge variant="outline">{provider.type}</Badge>
                    <Badge variant={provider.enabled ? 'secondary' : 'outline'}>{provider.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{provider.model} · {provider.baseUrl}</p>
                  {provider.health && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {provider.health.state === 'healthy' && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                      {provider.health.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void test(provider)} disabled={testingId === provider.id}>
                  {testingId === provider.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => edit(provider)}>Edit</Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${provider.name}`} onClick={() => setDeleteTarget(provider)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Usage (last 30 days)" description="Token totals are recorded from provider responses and support quota and cost review.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Analyses</p><p className="mt-1 text-2xl font-semibold">{usage.providers.reduce((sum, item) => sum + item.analyses, 0).toLocaleString()}</p></div>
          <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Input tokens</p><p className="mt-1 text-2xl font-semibold">{usage.providers.reduce((sum, item) => sum + item.inputTokens, 0).toLocaleString()}</p></div>
          <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Output tokens</p><p className="mt-1 text-2xl font-semibold">{usage.providers.reduce((sum, item) => sum + item.outputTokens, 0).toLocaleString()}</p></div>
          <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Total tokens</p><p className="mt-1 text-2xl font-semibold">{usage.providers.reduce((sum, item) => sum + item.totalTokens, 0).toLocaleString()}</p></div>
        </div>
      </SettingsSection>

      <Dialog open={formOpen} onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) {
          setEditingId(null);
          setForm(emptyProvider());
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit AI provider' : 'Add AI provider'}</DialogTitle>
            <DialogDescription>For Ollama, llama.cpp, vLLM, or another compatible runtime, use its OpenAI-compatible /v1 endpoint.</DialogDescription>
          </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="ai-name">Name</Label><Input id="ai-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Production assistant" /></div>
          <div className="space-y-2"><Label>Provider type</Label><Select value={form.type} onValueChange={(value) => changeType(value as AIProviderType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI API</SelectItem><SelectItem value="openai-compatible">OpenAI-compatible</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="ai-url">Base URL</Label><Input id="ai-url" value={form.baseUrl} disabled={form.type === 'openai'} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="ai-model">Model</Label><Input id="ai-model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Model exposed by the provider" /></div>
          <div className="space-y-2"><Label htmlFor="ai-key">API key {editingId && '(leave blank to keep current)'}</Label><Input id="ai-key" type="password" value={form.apiKey ?? ''} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} autoComplete="new-password" /></div>
          <div className="space-y-2"><Label htmlFor="ai-output">Maximum output tokens</Label><Input id="ai-output" type="number" min={1} max={12000} value={form.maxOutputTokens} onChange={(event) => setForm({ ...form, maxOutputTokens: Number(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="ai-limit">Daily token limit (0 = unlimited)</Label><Input id="ai-limit" type="number" min={0} value={form.dailyTokenLimit} onChange={(event) => setForm({ ...form, dailyTokenLimit: Number(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="ai-context">Maximum context characters</Label><Input id="ai-context" type="number" min={4000} max={250000} value={form.maxInputChars} onChange={(event) => setForm({ ...form, maxInputChars: Number(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="ai-timeout">Request timeout (seconds)</Label><Input id="ai-timeout" type="number" min={1} max={180} value={form.timeoutSeconds} onChange={(event) => setForm({ ...form, timeoutSeconds: Number(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="ai-retention">Analysis retention (days)</Label><Input id="ai-retention" type="number" min={1} max={365} value={form.retentionDays} onChange={(event) => setForm({ ...form, retentionDays: Number(event.target.value) })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Enabled</p><p className="text-xs text-muted-foreground">Allow read-only inference requests</p></div><Switch checked={form.enabled} onCheckedChange={(value) => setForm({ ...form, enabled: value })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Default provider</p><p className="text-xs text-muted-foreground">Selected when no provider is specified</p></div><Switch checked={form.default} onCheckedChange={(value) => setForm({ ...form, default: value })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Private network</p><p className="text-xs text-muted-foreground">Required for local runtimes</p></div><Switch checked={form.allowPrivateNetwork} disabled={form.type === 'openai'} onCheckedChange={(value) => setForm({ ...form, allowPrivateNetwork: value })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Inference egress</p><p className="text-xs text-muted-foreground">Master switch for provider calls</p></div><Switch checked={form.externalEgress} onCheckedChange={(value) => setForm({ ...form, externalEgress: value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !form.name.trim() || !form.model.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{editingId ? 'Save provider' : 'Add provider'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete AI provider?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} will be removed. Providers with analysis history may need to be disabled instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && void remove(deleteTarget)}>Delete provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
