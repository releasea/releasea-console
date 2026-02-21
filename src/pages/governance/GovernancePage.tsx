import { useEffect, useState, useMemo } from 'react';
import { format, isWithinInterval, parseISO, subDays } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Rocket,
  Globe,
  Shield,
  FileText,
  Settings,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  Users,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SettingsSection, SettingsGrid } from '@/components/layout/SettingsSection';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import {
  fetchApprovalRequests,
  fetchGovernanceSettings,
  fetchAuditLogs,
  updateGovernanceSettings,
  reviewApproval,
} from '@/lib/governance-data';
import type { ApprovalRequest, AuditLogEntry, GovernanceSettings } from '@/types/governance';

type AuditResourceFilter = 'all' | 'service' | 'rule' | 'deploy' | 'team' | 'settings' | 'user' | 'approval';
type AuditDateRange = '24h' | '7d' | '30d' | '90d' | 'all';

const GovernancePage = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [settings, setSettings] = useState<GovernanceSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditResourceFilter, setAuditResourceFilter] = useState<AuditResourceFilter>('all');
  const [auditDateRange, setAuditDateRange] = useState<AuditDateRange>('30d');
  const [auditPerformerFilter, setAuditPerformerFilter] = useState<string>('all');

  // Review modal state
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [approvalsData, settingsData, logsData] = await Promise.all([
          fetchApprovalRequests(),
          fetchGovernanceSettings(),
          fetchAuditLogs(),
        ]);
        setApprovals(approvalsData);
        setSettings(settingsData);
        setAuditLogs(logsData);
      } catch (error) {
        toast({
          title: 'Failed to load governance data',
          description: error instanceof Error ? error.message : 'Try again in a few moments.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const completedApprovals = approvals.filter(a => a.status !== 'pending');

  // Get unique performers for filter
  const uniquePerformers = useMemo(() => {
    const performers = new Map<string, { id: string; name: string }>();
    auditLogs.forEach(log => {
      if (!performers.has(log.performedBy.id)) {
        performers.set(log.performedBy.id, { id: log.performedBy.id, name: log.performedBy.name });
      }
    });
    return Array.from(performers.values());
  }, [auditLogs]);

  // Filter audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Search filter
      if (auditSearch) {
        const searchLower = auditSearch.toLowerCase();
        const matchesSearch =
          log.action.toLowerCase().includes(searchLower) ||
          log.resourceName.toLowerCase().includes(searchLower) ||
          log.performedBy.name.toLowerCase().includes(searchLower) ||
          log.performedBy.email.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Resource type filter
      if (auditResourceFilter !== 'all' && log.resourceType !== auditResourceFilter) {
        return false;
      }

      // Performer filter
      if (auditPerformerFilter !== 'all' && log.performedBy.id !== auditPerformerFilter) {
        return false;
      }

      // Date range filter
      if (auditDateRange !== 'all') {
        const logDate = parseISO(log.performedAt);
        const now = new Date();
        let startDate: Date;
        
        switch (auditDateRange) {
          case '24h':
            startDate = subDays(now, 1);
            break;
          case '7d':
            startDate = subDays(now, 7);
            break;
          case '30d':
            startDate = subDays(now, 30);
            break;
          case '90d':
            startDate = subDays(now, 90);
            break;
          default:
            startDate = subDays(now, 30);
        }

        if (!isWithinInterval(logDate, { start: startDate, end: now })) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, auditSearch, auditResourceFilter, auditDateRange, auditPerformerFilter]);

  const resetAuditFilters = () => {
    setAuditSearch('');
    setAuditResourceFilter('all');
    setAuditDateRange('30d');
    setAuditPerformerFilter('all');
  };

  const handleReview = async () => {
    if (!selectedApproval || !reviewAction) return;

    const success = await reviewApproval(
      selectedApproval.id,
      reviewAction === 'approve' ? 'approved' : 'rejected',
      reviewComment
    );

    if (success) {
      setApprovals(prev =>
        prev.map(a =>
          a.id === selectedApproval.id
            ? {
                ...a,
                status: reviewAction === 'approve' ? 'approved' : 'rejected',
                reviewedAt: new Date().toISOString(),
                reviewComment,
              }
            : a
        )
      );
      toast({
        title: reviewAction === 'approve' ? 'Approved' : 'Rejected',
        description: `Request has been ${reviewAction === 'approve' ? 'approved' : 'rejected'}.`,
      });
    } else {
      toast({
        title: 'Failed to review approval',
        description: 'The approval state could not be updated. Please try again.',
        variant: 'destructive',
      });
    }

    setSelectedApproval(null);
    setReviewAction(null);
    setReviewComment('');
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await updateGovernanceSettings(settings);
      toast({
        title: 'Settings saved',
        description: 'Governance settings have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Failed to save governance settings',
        description: error instanceof Error ? error.message : 'Try again in a few moments.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: ApprovalRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-primary/20 text-primary border-primary/30"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
    }
  };

  const getTypeIcon = (type: ApprovalRequest['type']) => {
    return type === 'deploy' ? <Rocket className="w-4 h-4" /> : <Globe className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <ListPageHeader
          title="Governance"
          description="Manage approvals, policies and audit logs"
        />

        <Tabs defaultValue="approvals" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="approvals" className="gap-2">
              <Shield className="w-4 h-4" />
              Approvals
              {pendingApprovals.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {pendingApprovals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2">
              <Settings className="w-4 h-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Approvals Tab */}
          <TabsContent value="approvals" className="space-y-6">
            {pendingApprovals.length > 0 && (
              <SettingsSection
                title="Pending approvals"
                description="Requests waiting for your review"
              >
                <div className="space-y-3">
                  {pendingApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {getTypeIcon(approval.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{approval.resourceName}</p>
                            <Badge variant="outline" className="text-xs">
                              {approval.type === 'deploy' ? 'Deploy' : 'Rule Publish'}
                            </Badge>
                            {approval.environment && (
                              <Badge variant="secondary" className="text-xs">{approval.environment}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Requested by {approval.requestedBy.name} • {format(new Date(approval.requestedAt), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedApproval(approval);
                            setReviewAction('reject');
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApproval(approval);
                            setReviewAction('approve');
                          }}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsSection>
            )}

            {pendingApprovals.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card/60 p-10">
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
                  title="All caught up"
                  description="No pending approvals at the moment."
                  tone="muted"
                />
              </div>
            )}

            {completedApprovals.length > 0 && (
              <SettingsSection
                title="Recent history"
                description="Previously reviewed requests"
              >
                <div className="space-y-2">
                  {completedApprovals.slice(0, 10).map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/50 bg-muted/10"
                    >
                      <div className="flex items-center gap-3">
                        {getTypeIcon(approval.type)}
                        <div>
                          <p className="text-sm font-medium text-foreground">{approval.resourceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {approval.requestedBy.name} → {approval.reviewedBy?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(approval.reviewedAt!), 'MMM d, HH:mm')}
                        </span>
                        {getStatusBadge(approval.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsSection>
            )}
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-6">
            {settings && (
              <>
                <SettingsSection
                  title="Deployment approval"
                  description="Require approval before deploying to specific environments"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">Enable deployment approval</p>
                        <p className="text-xs text-muted-foreground">Require admin approval for deployments</p>
                      </div>
                      <Switch
                        checked={settings.deployApproval.enabled}
                        onCheckedChange={(checked) =>
                          setSettings(prev => prev ? {
                            ...prev,
                            deployApproval: { ...prev.deployApproval, enabled: checked }
                          } : prev)
                        }
                      />
                    </div>
                    {settings.deployApproval.enabled && (
                      <SettingsGrid columns={2}>
                        <div className="space-y-2">
                          <Label>Environments requiring approval</Label>
                          <Input
                            value={settings.deployApproval.environments.join(', ')}
                            onChange={(e) =>
                              setSettings(prev => prev ? {
                                ...prev,
                                deployApproval: {
                                  ...prev.deployApproval,
                                  environments: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                }
                              } : prev)
                            }
                            className="bg-muted/40"
                            placeholder="prod, staging"
                          />
                          <p className="text-xs text-muted-foreground">Comma-separated list</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Minimum approvers</Label>
                          <Input
                            type="number"
                            min={1}
                            value={settings.deployApproval.minApprovers}
                            onChange={(e) =>
                              setSettings(prev => prev ? {
                                ...prev,
                                deployApproval: {
                                  ...prev.deployApproval,
                                  minApprovers: parseInt(e.target.value) || 1
                                }
                              } : prev)
                            }
                            className="bg-muted/40"
                          />
                        </div>
                      </SettingsGrid>
                    )}
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Rule publish approval"
                  description="Require approval before publishing rules to external gateways"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">Enable rule publish approval</p>
                        <p className="text-xs text-muted-foreground">Require admin approval for rule publication</p>
                      </div>
                      <Switch
                        checked={settings.rulePublishApproval.enabled}
                        onCheckedChange={(checked) =>
                          setSettings(prev => prev ? {
                            ...prev,
                            rulePublishApproval: { ...prev.rulePublishApproval, enabled: checked }
                          } : prev)
                        }
                      />
                    </div>
                    {settings.rulePublishApproval.enabled && (
                      <>
                        <div className="flex items-center justify-between py-3 border-b border-border/50">
                          <div>
                            <p className="text-sm font-medium text-foreground">External only</p>
                            <p className="text-xs text-muted-foreground">Only require approval for external gateway publishing</p>
                          </div>
                          <Switch
                            checked={settings.rulePublishApproval.externalOnly}
                            onCheckedChange={(checked) =>
                              setSettings(prev => prev ? {
                                ...prev,
                                rulePublishApproval: { ...prev.rulePublishApproval, externalOnly: checked }
                              } : prev)
                            }
                          />
                        </div>
                        <div className="space-y-2 max-w-xs">
                          <Label>Minimum approvers</Label>
                          <Input
                            type="number"
                            min={1}
                            value={settings.rulePublishApproval.minApprovers}
                            onChange={(e) =>
                              setSettings(prev => prev ? {
                                ...prev,
                                rulePublishApproval: {
                                  ...prev.rulePublishApproval,
                                  minApprovers: parseInt(e.target.value) || 1
                                }
                              } : prev)
                            }
                            className="bg-muted/40"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Audit settings"
                  description="Configure audit log retention"
                >
                  <div className="space-y-2 max-w-xs">
                    <Label>Retention period (days)</Label>
                    <Input
                      type="number"
                      min={30}
                      value={settings.auditRetentionDays}
                      onChange={(e) =>
                        setSettings(prev => prev ? {
                          ...prev,
                          auditRetentionDays: parseInt(e.target.value) || 90
                        } : prev)
                      }
                      className="bg-muted/40"
                    />
                    <p className="text-xs text-muted-foreground">Minimum 30 days</p>
                  </div>
                </SettingsSection>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button onClick={handleSaveSettings} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save policies'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border border-border bg-muted/10">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, resources, users..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Filter className="w-4 h-4" />
                      Type
                      {auditResourceFilter !== 'all' && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                          {auditResourceFilter}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="end">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Resource Type</Label>
                      <Select value={auditResourceFilter} onValueChange={(v) => setAuditResourceFilter(v as AuditResourceFilter)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="deploy">Deploy</SelectItem>
                          <SelectItem value="rule">Rule</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                          <SelectItem value="settings">Settings</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="approval">Approval</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      Period
                      {auditDateRange !== '30d' && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                          {auditDateRange}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="end">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Time Period</Label>
                      <Select value={auditDateRange} onValueChange={(v) => setAuditDateRange(v as AuditDateRange)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24h">Last 24 hours</SelectItem>
                          <SelectItem value="7d">Last 7 days</SelectItem>
                          <SelectItem value="30d">Last 30 days</SelectItem>
                          <SelectItem value="90d">Last 90 days</SelectItem>
                          <SelectItem value="all">All time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Users className="w-4 h-4" />
                      User
                      {auditPerformerFilter !== 'all' && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0">1</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Performed By</Label>
                      <Select value={auditPerformerFilter} onValueChange={setAuditPerformerFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All users</SelectItem>
                          {uniquePerformers.map(performer => (
                            <SelectItem key={performer.id} value={performer.id}>
                              {performer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>

                {(auditSearch || auditResourceFilter !== 'all' || auditDateRange !== '30d' || auditPerformerFilter !== 'all') && (
                  <Button variant="ghost" size="sm" onClick={resetAuditFilters} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Results summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {filteredAuditLogs.length} of {auditLogs.length} entries
              </span>
            </div>

            <SettingsSection
              title="Activity log"
              description="Recent actions performed on the platform"
            >
              {filteredAuditLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/60 p-10">
                  <EmptyState
                    icon={<Search className="h-5 w-5 text-muted-foreground" />}
                    title="No entries found"
                    description="Try adjusting your filters or search term."
                    actionLabel="Reset filters"
                    onAction={resetAuditFilters}
                    tone="muted"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between py-3 px-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                          {log.resourceType === 'deploy' && <Rocket className="w-4 h-4" />}
                          {log.resourceType === 'rule' && <Globe className="w-4 h-4" />}
                          {log.resourceType === 'service' && <AlertCircle className="w-4 h-4" />}
                          {log.resourceType === 'team' && <Users className="w-4 h-4" />}
                          {log.resourceType === 'settings' && <Settings className="w-4 h-4" />}
                          {log.resourceType === 'user' && <Shield className="w-4 h-4" />}
                          {log.resourceType === 'approval' && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {log.action.replace(/\./g, ' ').replace(/_/g, ' ')}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {log.resourceType}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {log.resourceName} • {log.performedBy.name}
                          </p>
                          {log.details && (
                            <p className="text-xs text-muted-foreground/80 mt-1 font-mono">
                              {JSON.stringify(log.details).slice(0, 80)}
                              {JSON.stringify(log.details).length > 80 && '...'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.performedAt), 'MMM d, HH:mm')}
                        </p>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground/60 font-mono">{log.ipAddress}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Modal */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Request
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Confirm approval for this request.'
                : 'Provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  {getTypeIcon(selectedApproval.type)}
                  <span className="font-medium">{selectedApproval.resourceName}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Requested by {selectedApproval.requestedBy.name}
                </p>
                {selectedApproval.metadata && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono">
                    {selectedApproval.metadata.version && <p>Version: {selectedApproval.metadata.version}</p>}
                    {selectedApproval.metadata.branch && <p>Branch: {selectedApproval.metadata.branch}</p>}
                    {selectedApproval.metadata.hosts && <p>Hosts: {selectedApproval.metadata.hosts.join(', ')}</p>}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Comment {reviewAction === 'reject' && '(required)'}</Label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={reviewAction === 'approve' ? 'Optional comment...' : 'Reason for rejection...'}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApproval(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={reviewAction === 'reject' && !reviewComment.trim()}
            >
              {reviewAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default GovernancePage;
