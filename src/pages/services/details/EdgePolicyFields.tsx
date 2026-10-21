import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { RulePolicyConfig } from '@/types/releasea';
import type { EdgePolicyDraft } from './edge-policy';

type EdgePolicyFieldsProps = {
  action: RulePolicyConfig['action'];
  authMode: NonNullable<RulePolicyConfig['authMode']>;
  draft: EdgePolicyDraft;
  onChange: (draft: EdgePolicyDraft) => void;
  idPrefix: string;
};

export function EdgePolicyFields({ action, authMode, draft, onChange, idPrefix }: EdgePolicyFieldsProps) {
  const update = (patch: Partial<EdgePolicyDraft>) => onChange({ ...draft, ...patch });
  const allow = action === 'allow';

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-timeout`}>Timeout (ms)</Label>
          <Input id={`${idPrefix}-timeout`} type="number" min={100} max={60000} value={draft.timeoutMs} onChange={(event) => update({ timeoutMs: Number(event.target.value) })} className="bg-muted/40 font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-retries`}>Retries</Label>
          <Input id={`${idPrefix}-retries`} type="number" min={0} max={5} value={draft.retries} onChange={(event) => update({ retries: Number(event.target.value) })} className="bg-muted/40 font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-rate`}>Requests per window</Label>
          <Input id={`${idPrefix}-rate`} type="number" min={0} value={draft.rateLimitRequests} onChange={(event) => update({ rateLimitRequests: Number(event.target.value) })} className="bg-muted/40 font-mono text-xs" />
          <p className="text-[11px] text-muted-foreground">0 disables the gateway rate limit.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-window`}>Window (seconds)</Label>
          <Input id={`${idPrefix}-window`} type="number" min={1} max={3600} value={draft.rateLimitWindowSeconds} onChange={(event) => update({ rateLimitWindowSeconds: Number(event.target.value) })} className="bg-muted/40 font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-body`}>Max body (bytes)</Label>
          <Input id={`${idPrefix}-body`} type="number" min={0} value={draft.maxBodyBytes} onChange={(event) => update({ maxBodyBytes: Number(event.target.value) })} className="bg-muted/40 font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-circuit`}>Circuit breaker errors</Label>
          <Input id={`${idPrefix}-circuit`} type="number" min={0} max={20} value={draft.circuitConsecutiveErrors} onChange={(event) => update({ circuitConsecutiveErrors: Number(event.target.value) })} className="bg-muted/40 font-mono text-xs" />
          <p className="text-[11px] text-muted-foreground">Consecutive 5xx responses before ejection. 0 disables it.</p>
        </div>
      </div>

      {allow && (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>IP policy</Label>
            <Select value={draft.ipPolicy} onValueChange={(value) => update({ ipPolicy: value as EdgePolicyDraft['ipPolicy'] })}>
              <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="allowlist">Allow listed networks</SelectItem>
                <SelectItem value="blocklist">Block listed networks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-headers`}>Required headers</Label>
            <Input id={`${idPrefix}-headers`} value={draft.requiredHeaders} onChange={(event) => update({ requiredHeaders: event.target.value })} placeholder="x-request-id, x-tenant" className="bg-muted/40 font-mono text-xs" />
          </div>
          {authMode === 'jwt' ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-scopes`}>Required scopes</Label>
              <Input id={`${idPrefix}-scopes`} value={draft.requiredScopes} onChange={(event) => update({ requiredScopes: event.target.value })} placeholder="orders.read, orders.write" className="bg-muted/40 font-mono text-xs" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-cors`}>CORS</Label>
              <div className="flex h-10 items-center justify-between rounded-md border border-border bg-muted/30 px-3">
                <span className="text-xs text-muted-foreground">Browser preflight</span>
                <Switch id={`${idPrefix}-cors`} checked={draft.corsEnabled} onCheckedChange={(checked) => update({ corsEnabled: checked })} />
              </div>
            </div>
          )}
          {draft.ipPolicy !== 'open' && (
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`${idPrefix}-ips`}>IP addresses or CIDRs</Label>
              <Textarea id={`${idPrefix}-ips`} value={draft.ipList} onChange={(event) => update({ ipList: event.target.value })} placeholder="203.0.113.0/24, 198.51.100.10" className="min-h-16 bg-muted/40 font-mono text-xs" />
            </div>
          )}
          {authMode === 'apikey' && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-key-header`}>API key header</Label>
                <Input id={`${idPrefix}-key-header`} value={draft.apiKeyHeader} onChange={(event) => update({ apiKeyHeader: event.target.value })} className="bg-muted/40 font-mono text-xs" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${idPrefix}-keys`}>API keys</Label>
                <Textarea id={`${idPrefix}-keys`} value={draft.apiKeys} onChange={(event) => update({ apiKeys: event.target.value })} placeholder="one key per line" className="min-h-16 bg-muted/40 font-mono text-xs" />
              </div>
            </>
          )}
          {authMode === 'jwt' && (
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`${idPrefix}-cors`}>CORS</Label>
              <div className="flex h-10 items-center justify-between rounded-md border border-border bg-muted/30 px-3">
                <span className="text-xs text-muted-foreground">Answer browser preflight at the gateway.</span>
                <Switch id={`${idPrefix}-cors`} checked={draft.corsEnabled} onCheckedChange={(checked) => update({ corsEnabled: checked })} />
              </div>
            </div>
          )}
          {draft.corsEnabled && (
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`${idPrefix}-cors-origins`}>Allowed origins</Label>
              <Input id={`${idPrefix}-cors-origins`} value={draft.corsOrigins} onChange={(event) => update({ corsOrigins: event.target.value })} placeholder="https://app.example.com, https://admin.example.com" className="bg-muted/40 font-mono text-xs" />
            </div>
          )}
        </div>
      )}

      <div className={allow ? 'grid gap-2.5 sm:grid-cols-2' : 'grid gap-2.5'}>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
          <div>
            <Label htmlFor={`${idPrefix}-headers-security`}>Security headers</Label>
            <p className="text-[11px] text-muted-foreground">nosniff, frame denial, referrer policy, and HSTS.</p>
          </div>
          <Switch id={`${idPrefix}-headers-security`} checked={draft.securityHeaders} onCheckedChange={(checked) => update({ securityHeaders: checked })} />
        </div>
        {allow && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <div>
              <Label htmlFor={`${idPrefix}-lock`}>Restrict ingress</Label>
              <p className="text-[11px] text-muted-foreground">Only the gateway namespace and this namespace.</p>
            </div>
            <Switch id={`${idPrefix}-lock`} checked={draft.lockNetwork} onCheckedChange={(checked) => update({ lockNetwork: checked })} />
          </div>
        )}
      </div>
    </div>
  );
}
