import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableEmptyRow } from '@/components/layout/EmptyState';
import { TablePagination } from '@/components/layout/TablePagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { TabsContent } from '@/components/ui/tabs';
import { ServiceTypeIcon } from '@/components/ui/service-type-icon';
import { getEnvironmentLabel } from '@/lib/environments';
import type { Environment, ManagedRule, Service } from '@/types/releasea';
import { format } from 'date-fns';
import { Copy, Globe, MoreVertical, Pencil, Plus, Route as RouteIcon, ShieldCheck, Trash2 } from 'lucide-react';
import { getGatewayTargets } from '../constants';
import type { RuleRow } from '../types';

type PaginationState = {
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (value: number) => void;
};

type RulesTabProps = {
  service: Service;
  viewEnv: Environment;
  environmentRules: ManagedRule[];
  visibleServiceRules: ManagedRule[];
  pagination: PaginationState;
  onCreateRule: () => void;
  onOpenEditRule: (rule: ManagedRule) => void;
  onOpenCopyRule: (rule: ManagedRule) => void;
  onOpenPublishRule: (rule: ManagedRule) => void;
  onDeleteRule: (rule: RuleRow) => void;
};

export const RulesTab = ({
  service,
  viewEnv,
  environmentRules,
  visibleServiceRules,
  pagination,
  onCreateRule,
  onOpenEditRule,
  onOpenCopyRule,
  onOpenPublishRule,
  onDeleteRule,
}: RulesTabProps) => (
  <TabsContent value="rules" className="space-y-4">
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Rules</h3>
          <p className="text-xs text-muted-foreground">
            {environmentRules.length} total in {getEnvironmentLabel(viewEnv)}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={onCreateRule}>
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Rule
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Methods
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Lifecycle
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Publication
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Published
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleServiceRules.map((rule) => {
              const ruleWithPolicy: RuleRow = {
                ...rule,
                serviceName: service.name,
              };
              const publicationTargets = getGatewayTargets(rule.gateways);
              const hasPublication = publicationTargets.internal || publicationTargets.external;
              const isQueued = rule.status === 'queued';
              const isInProgress = rule.status === 'in-progress';
              const isPublishing = rule.status === 'publishing' || ((isQueued || isInProgress) && hasPublication);
              const isUnpublishing = rule.status === 'unpublishing' || ((isQueued || isInProgress) && !hasPublication);
              const lifecycleStatus = isPublishing
                ? isQueued
                  ? 'queued'
                  : 'publishing'
                : isUnpublishing
                  ? isQueued
                    ? 'queued'
                    : 'unpublishing'
                  : hasPublication
                    ? 'published'
                    : 'unpublished';
              const actionLabel = rule.policy?.action ?? 'allow';
              const methods = rule.methods.length ? rule.methods : ['ANY'];
              const visibleMethods = methods.slice(0, 3);
              const extraMethods = Math.max(0, methods.length - visibleMethods.length);
              const lastPublishedLabel =
                rule.lastPublishedAt && !Number.isNaN(new Date(rule.lastPublishedAt).getTime())
                  ? format(new Date(rule.lastPublishedAt), 'MMM dd, HH:mm')
                  : null;
              const publishedDateLabel = isPublishing || isUnpublishing
                ? 'Syncing...'
                : hasPublication && lastPublishedLabel
                  ? lastPublishedLabel
                  : '-';
              return (
                <tr
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEditRule(rule)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenEditRule(rule);
                    }
                  }}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ServiceTypeIcon type={service.type} size="sm" />
                      <div>
                        <p className="font-mono font-medium text-foreground">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {actionLabel === 'allow' ? 'Allow' : 'Deny'} • {rule.paths.length} path(s) •{' '}
                          {rule.hosts.length} host(s)
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {visibleMethods.map((method) => (
                        <Badge
                          key={`${rule.id}-${method}`}
                          variant="outline"
                          className="font-mono uppercase"
                        >
                          {method}
                        </Badge>
                      ))}
                      {extraMethods > 0 && (
                        <Badge variant="outline" className="font-mono uppercase">
                          +{extraMethods}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={lifecycleStatus} className="normal-case" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant={publicationTargets.internal ? 'secondary' : 'outline'}
                        className="flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Internal
                      </Badge>
                      <Badge
                        variant={publicationTargets.external ? 'secondary' : 'outline'}
                        className="flex items-center gap-1"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        External
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-muted-foreground">{publishedDateLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onOpenEditRule(rule)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit rule
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onOpenCopyRule(rule)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy to environments
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onOpenPublishRule(rule)}>
                          <Globe className="w-4 h-4 mr-2" />
                          Manage publication
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => onDeleteRule(ruleWithPolicy)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {environmentRules.length === 0 && (
              <TableEmptyRow colSpan={6} icon={<RouteIcon className="h-5 w-5 text-muted-foreground" />} />
            )}
          </tbody>
        </table>
      </div>
      {environmentRules.length > 0 && (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={environmentRules.length}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
        />
      )}
    </div>
  </TabsContent>
);
