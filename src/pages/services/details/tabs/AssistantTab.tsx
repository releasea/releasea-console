import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Clock3, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { createServiceAIAnalysis, fetchAvailableAIProviders, fetchServiceAIAnalyses } from '@/lib/data';
import type { AIAnalysis, AIAnalysisKind, AIProviderOption } from '@/types/releasea';

interface AssistantTabProps {
  serviceId: string;
  environment: string;
}

const analysisOptions: Array<{ kind: AIAnalysisKind; label: string; description: string }> = [
  { kind: 'health-summary', label: 'Summarize health', description: 'Review recent deploys, runtime logs, and platform events.' },
  { kind: 'failed-deploy', label: 'Explain failed deploy', description: 'Identify likely causes using the latest failed delivery evidence.' },
  { kind: 'correction-plan', label: 'Propose correction plan', description: 'Build a human-reviewed sequence of low-risk next steps.' },
];

const severityVariant = (severity?: string): 'destructive' | 'secondary' | 'outline' =>
  severity === 'critical' ? 'destructive' : severity === 'warning' ? 'secondary' : 'outline';

export function AssistantTab({ serviceId, environment }: AssistantTabProps) {
  const [history, setHistory] = useState<AIAnalysis[]>([]);
  const [providers, setProviders] = useState<AIProviderOption[]>([]);
  const [providerId, setProviderId] = useState('');
  const [kind, setKind] = useState<AIAnalysisKind>('health-summary');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => setHistory(await fetchServiceAIAnalyses(serviceId)), [serviceId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    void fetchAvailableAIProviders().then((items) => {
      if (!active) return;
      setProviders(items);
      setProviderId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items.find((item) => item.default)?.id ?? items[0]?.id ?? '';
      });
    });
    return () => { active = false; };
  }, []);
  const latest = useMemo(() => history.find((item) => item.status === 'completed'), [history]);

  const run = async () => {
    setBusy(true);
    const result = await createServiceAIAnalysis(serviceId, { kind, providerId, question, environment });
    setBusy(false);
    if (!result) {
      toast({ title: 'Analysis unavailable', description: 'Configure and validate a default AI provider in Platform Settings.', variant: 'destructive' });
      return;
    }
    setQuestion('');
    await refresh();
    toast({ title: 'Operational analysis completed', description: 'Review the cited evidence before applying any recommendation.' });
  };

  return (
    <TabsContent value="assistant" className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h2 className="font-semibold">Operational assistant</h2></div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Read-only diagnostics based on sanitized service configuration, recent deploys, logs, and audit events. Recommendations never execute automatically.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1"><ShieldCheck className="h-3.5 w-3.5" />Human review required</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {analysisOptions.map((option) => (
            <button key={option.kind} type="button" onClick={() => setKind(option.kind)} className={`rounded-lg border p-4 text-left transition-colors ${kind === option.kind ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
              <p className="text-sm font-medium">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>
        <Textarea className="mt-4" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Optional: add a specific question, for example: Why did readiness fail after the latest deploy?" maxLength={2000} />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Environment: {environment || 'all available evidence'}</p>
            {providers.length > 0 ? (
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger className="w-full sm:w-[320px]" aria-label="AI provider"><SelectValue placeholder="Select an AI provider" /></SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} · {provider.model}{provider.default ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : <p className="text-xs text-warning">No enabled provider is available. Ask an administrator to configure one.</p>}
          </div>
          <Button onClick={() => void run()} disabled={busy || !providerId}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}{busy ? 'Analyzing evidence…' : 'Run analysis'}
          </Button>
        </div>
      </div>

      {latest?.result && (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Latest analysis</p><h3 className="mt-1 text-lg font-semibold">{latest.result.summary}</h3></div>
            <Badge variant={severityVariant(latest.result.severity)}>{latest.result.severity}</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3"><h4 className="text-sm font-semibold">Findings</h4>{latest.result.findings.map((finding, index) => <div key={`${finding.title}-${index}`} className="rounded-md border p-3"><p className="text-sm font-medium">{finding.title}</p><p className="mt-1 text-sm text-muted-foreground">{finding.explanation}</p><div className="mt-2 flex flex-wrap gap-1">{finding.evidenceIds.map((id) => <Badge key={id} variant="outline" className="text-[10px]">{id}</Badge>)}</div></div>)}</div>
            <div className="space-y-3"><h4 className="text-sm font-semibold">Proposed next steps</h4>{latest.result.recommendations.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-md border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{item.title}</p><Badge variant="outline" className="text-[10px]">{item.risk} risk</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><div className="mt-2 flex flex-wrap gap-1">{item.evidenceIds.map((id) => <Badge key={id} variant="outline" className="text-[10px]">{id}</Badge>)}</div></div>)}</div>
          </div>
          {latest.result.limitations.length > 0 && <div className="rounded-md bg-muted/40 p-3"><p className="text-xs font-medium">Limitations</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{latest.result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {latest.evidenceTruncated && <p className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">The evidence bundle reached the provider context limit. The analysis only cites evidence that was actually included.</p>}
          <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground"><span>{latest.providerName || latest.providerId} · {latest.model}</span><span>{latest.usage?.totalTokens ?? 0} tokens</span><span>{latest.durationMs ?? 0} ms</span></div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Analysis history</h3><Button variant="ghost" size="sm" onClick={() => void refresh()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh</Button></div>
        <div className="mt-3 space-y-2">
          {history.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No analyses have been run for this service.</p>}
          {history.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Badge variant="outline">{item.kind}</Badge><Badge variant={item.status === 'completed' ? 'secondary' : 'destructive'}>{item.status}</Badge></div><p className="mt-1 text-sm">{item.result?.summary || item.error || 'Analysis did not return a summary.'}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{new Date(item.createdAt).toLocaleString()}</span></div>)}
        </div>
      </div>
    </TabsContent>
  );
}
