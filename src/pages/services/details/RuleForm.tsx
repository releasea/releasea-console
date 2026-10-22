import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { RulePolicyConfig } from '@/types/releasea';
import { X } from 'lucide-react';
import { ruleMethods } from './constants';
import type { EdgePolicyDraft } from './edge-policy';
import { EdgePolicyFields } from './EdgePolicyFields';

const ruleTabPanelClassName = 'mt-0 flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden';

const fieldLabelClassName = 'text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground';

type RuleNote = { title: string; body: string };

export function RuleContextPane({
  children,
  notes,
  outcome,
  fill = true,
  className,
}: {
  children: ReactNode;
  notes: RuleNote[];
  outcome: string;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('grid min-h-0 lg:grid-cols-[minmax(0,1fr)_260px]', fill ? 'h-full overflow-y-auto lg:overflow-hidden' : 'h-auto', className)}>
      <div className={cn('min-h-0 px-6 py-5', fill ? 'lg:h-full lg:overflow-y-auto' : 'h-auto')}>{children}</div>
      <aside className="flex min-h-0 flex-col border-t border-border/70 bg-muted/15 px-5 py-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <p className={fieldLabelClassName}>Guidance</p>
        <ul className="mt-3 space-y-3">
          {notes.map((note) => (
            <li key={note.title}>
              <p className="text-sm font-medium text-foreground">{note.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{note.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground lg:mt-auto">{outcome}</p>
      </aside>
    </div>
  );
}

const ruleAuthOptions = [
  ['public', 'Public', 'No token required'],
  ['jwt', 'JWT / OIDC', 'Issuer and signature'],
  ['apikey', 'API key', 'Gateway key'],
  ['mtls', 'Mesh mTLS', 'Istio identity'],
] as const;

type RuleAuthMode = NonNullable<RulePolicyConfig['authMode']>;

export type RuleFormTab = 'route' | 'access' | 'edge';

export type RuleFormProps = {
  tabKey: string;
  idPrefix: string;
  name: string;
  onNameChange: (value: string) => void;
  action: RulePolicyConfig['action'];
  onActionChange: (value: RulePolicyConfig['action']) => void;
  authMode: RuleAuthMode;
  onAuthModeChange: (value: RuleAuthMode) => void;
  jwtIssuer: string;
  onJwtIssuerChange: (value: string) => void;
  jwksUri: string;
  onJwksUriChange: (value: string) => void;
  audiences: string;
  onAudiencesChange: (value: string) => void;
  edge: EdgePolicyDraft;
  onEdgeChange: (value: EdgePolicyDraft) => void;
  methods: string[];
  onToggleMethod: (method: string) => void;
  pathDraft: string;
  onPathDraftChange: (value: string) => void;
  onAddPath: () => void;
  paths: string[];
  onRemovePath: (path: string) => void;
  activeTab?: RuleFormTab;
  onActiveTabChange?: (tab: RuleFormTab) => void;
};

export function RuleForm({
  tabKey,
  idPrefix,
  name,
  onNameChange,
  action,
  onActionChange,
  authMode,
  onAuthModeChange,
  jwtIssuer,
  onJwtIssuerChange,
  jwksUri,
  onJwksUriChange,
  audiences,
  onAudiencesChange,
  edge,
  onEdgeChange,
  methods,
  onToggleMethod,
  pathDraft,
  onPathDraftChange,
  onAddPath,
  paths,
  onRemovePath,
  activeTab,
  onActiveTabChange,
}: RuleFormProps) {
  const tabCount = 3;
  const routeNotes: RuleNote[] = [
    { title: 'Match', body: 'Methods and paths decide which requests this rule handles. A path starts with /.' },
    { title: 'Action', body: 'Allow forwards matching traffic. Deny stops it at the gateway.' },
  ];
  const accessNotes: RuleNote[] = action === 'deny'
    ? [
        { title: 'Blocked', body: 'Matching requests never reach the service.' },
        { title: 'No credential', body: 'A denied route does not ask for a token, key, or mesh identity.' },
      ]
    : [
        { title: 'Where it is checked', body: 'The gateway validates the caller before the request reaches the service.' },
        { title: 'JWT and keys', body: 'Issuer, JWKS, and API keys are configured here and on Edge.' },
      ];
  const edgeNotes: RuleNote[] = [
    { title: 'Gateway first', body: 'Timeout, retries, rate, and body size run before the service sees the request.' },
    { title: 'Off switches', body: 'A rate of 0 disables the limit. A circuit breaker of 0 disables ejection.' },
  ];
  const accessOutcome = action === 'deny'
    ? 'Change the action to Allow on Route to choose how callers authenticate.'
    : authMode === 'jwt'
      ? 'Issuer and JWKS are required before this route can be saved.'
      : authMode === 'apikey'
        ? 'The key header and accepted keys are set on Edge.'
        : authMode === 'mtls'
          ? 'Callers must present an Istio identity. No token is read.'
          : 'Public routes skip credentials. Use this only when the path is safe to expose.';

  return (
    <Tabs
      key={tabKey}
      value={activeTab}
      defaultValue={activeTab ? undefined : 'route'}
      onValueChange={(value) => onActiveTabChange?.(value as RuleFormTab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-border/70 px-6">
        <TabsList className="-mb-px grid h-12 w-full bg-transparent p-0" style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
          <TabsTrigger value="route" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Route</TabsTrigger>
          <TabsTrigger value="access" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Access</TabsTrigger>
          <TabsTrigger value="edge" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Edge</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="route" className={ruleTabPanelClassName}>
        <RuleContextPane
          notes={routeNotes}
          outcome="This form saves the rule. Publication and promotion stay separate actions."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-name`} className={fieldLabelClassName}>Rule name</Label>
                <Input
                  id={`${idPrefix}-name`}
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="allow-auth"
                  className="bg-muted/40 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={fieldLabelClassName}>Action</Label>
                <Select value={action} onValueChange={(value) => onActionChange(value as RulePolicyConfig['action'])}>
                  <SelectTrigger className="bg-muted/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className={fieldLabelClassName}>Methods</p>
              <div className="grid grid-cols-7 gap-1.5">
                {ruleMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onToggleMethod(method)}
                    className={cn(
                      'h-8 rounded-md border font-mono text-[11px] font-medium transition-colors',
                      methods.includes(method)
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className={fieldLabelClassName}>Paths</p>
              <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                <div className="flex gap-2">
                  <Input
                    value={pathDraft}
                    onChange={(event) => onPathDraftChange(event.target.value)}
                    placeholder="/api/v1/*"
                    className="bg-background font-mono text-sm"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onAddPath();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={onAddPath}>
                    Add path
                  </Button>
                </div>
                <div className="mt-2 flex min-h-8 flex-wrap gap-2">
                  {paths.map((path) => (
                    <Badge key={path} variant="secondary" className="gap-1 font-mono normal-case">
                      {path}
                      <button type="button" onClick={() => onRemovePath(path)} aria-label={`Remove ${path}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {paths.length === 0 && (
                    <p className="text-xs text-warning">At least one path is required.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </RuleContextPane>
      </TabsContent>
      <TabsContent value="access" className={ruleTabPanelClassName}>
        <RuleContextPane notes={accessNotes} outcome={accessOutcome}>
          {action === 'deny' ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4">
              <p className="text-sm font-medium text-foreground">Matching traffic is denied</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Requests that match the methods and paths on Route are blocked at the gateway. Authentication is not evaluated.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-border/70">
                {ruleAuthOptions.map(([option, title, description], index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onAuthModeChange(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition-colors',
                      index > 0 && 'border-t border-border/70',
                      authMode === option ? 'bg-primary/5' : 'hover:bg-muted/30',
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">{title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                    </span>
                    <span className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full border',
                      authMode === option ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )} />
                  </button>
                ))}
              </div>
              {authMode === 'jwt' && (
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-jwt-issuer`} className={fieldLabelClassName}>JWT issuer</Label>
                    <Input id={`${idPrefix}-jwt-issuer`} value={jwtIssuer} onChange={(event) => onJwtIssuerChange(event.target.value)} placeholder="https://id.example.com/realms/platform" className="bg-muted/40 font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-jwks-uri`} className={fieldLabelClassName}>JWKS URL</Label>
                    <Input id={`${idPrefix}-jwks-uri`} value={jwksUri} onChange={(event) => onJwksUriChange(event.target.value)} placeholder="https://id.example.com/.well-known/jwks.json" className="bg-muted/40 font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-audiences`} className={fieldLabelClassName}>Allowed audiences</Label>
                    <Input id={`${idPrefix}-audiences`} value={audiences} onChange={(event) => onAudiencesChange(event.target.value)} placeholder="payments-api, internal-clients" className="bg-muted/40 font-mono text-xs" />
                  </div>
                </div>
              )}
            </div>
          )}
        </RuleContextPane>
      </TabsContent>
      <TabsContent value="edge" className={ruleTabPanelClassName}>
        <RuleContextPane
          notes={edgeNotes}
          outcome="IP policy, headers, scopes, and CORS apply only when the action is Allow."
        >
          <EdgePolicyFields
            idPrefix={idPrefix}
            action={action}
            authMode={authMode}
            draft={edge}
            onChange={onEdgeChange}
          />
        </RuleContextPane>
      </TabsContent>
    </Tabs>
  );
}
