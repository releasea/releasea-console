import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isWithinInterval, parseISO, subDays } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
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
  Plus,
  Trash2,
  Download,
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
import { maskIPAddress, redactSensitiveText, sanitizeTextForRender } from '@/platform/security/data-security';
import { GOVERNANCE_POLICY_PACKS, applyGovernancePolicyPack } from '@/lib/governance-packs';
import { summarizeDeployPolicyViolations } from '@/lib/deploy-policy';
import { fetchServiceDeployPolicyCheck, fetchServices } from '@/lib/data';
import { cn } from '@/lib/utils';
import {
  buildGovernancePolicyDocument,
  createGovernanceException,
  fetchApprovalRequests,
  fetchGovernanceExceptions,
  fetchGovernanceSettings,
  fetchAuditLogs,
  revokeGovernanceException,
  updateGovernanceSettings,
  reviewApproval,
} from '@/lib/governance-data';
import type {
  ApprovalRequest,
  AuditLogEntry,
  DeployPolicyViolation,
  GovernanceSettings,
  GovernanceTemporaryException,
} from '@/types/governance';
import type { Service } from '@/types/releasea';

type AuditResourceFilter = 'all' | 'service' | 'rule' | 'deploy' | 'team' | 'settings' | 'user' | 'approval' | 'operation' | 'worker';
type AuditDateRange = '24h' | '7d' | '30d' | '90d' | 'all';
type DeployPolicyRule = GovernanceSettings['deployPolicy']['rules'][number];
type GovernanceTab = 'approvals' | 'policies' | 'audit';
type PolicySimulationState = 'clear' | 'warning' | 'blocked' | 'unavailable';
type PolicySimulationResult = {
  serviceId: string;
  serviceName: string;
  projectId: string;
  sourceType: string;
  managementMode: string;
  state: PolicySimulationState;
  summary: string;
  violations: DeployPolicyViolation[];
  dryRun: boolean;
};

const parsePolicyList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const formatLocalDateTimeInput = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildDefaultExceptionForm = (serviceId: string = '') => ({
  serviceId,
  environment: 'prod',
  codes: '*',
  reason: '',
  expiresAt: formatLocalDateTimeInput(new Date(Date.now() + 72 * 60 * 60 * 1000)),
});

const DEPLOY_POLICY_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  rules: DeployPolicyRule[];
}> = [
  {
    id: 'development-open',
    label: 'Development Open',
    description: 'Minimal guardrails for fast iteration in development.',
    rules: [
      {
        environment: 'dev',
        allowAutoDeploy: true,
        requireExplicitVersion: false,
        blockExternalExposure: false,
        allowedProfileIds: [],
        allowedScmProviders: [],
        allowedRegistryProviders: [],
        allowedSecretProviders: [],
        allowedSourceTypes: [],
        allowedRegistries: [],
        allowedStrategies: [],
        maxReplicas: 0,
      },
    ],
  },
  {
    id: 'staging-balanced',
    label: 'Staging Balanced',
    description: 'Keep version pinning and moderate rollout controls before production.',
    rules: [
      {
        environment: 'staging',
        allowAutoDeploy: true,
        requireExplicitVersion: true,
        blockExternalExposure: false,
        allowedProfileIds: [],
        allowedScmProviders: [],
        allowedRegistryProviders: [],
        allowedSecretProviders: [],
        allowedSourceTypes: ['git', 'registry'],
        allowedRegistries: [],
        allowedStrategies: ['rolling', 'canary'],
        maxReplicas: 6,
      },
    ],
  },
  {
    id: 'production-strict',
    label: 'Production Strict',
    description: 'Disable auto deploy and require pinned registry-based rollouts in production.',
    rules: [
      {
        environment: 'prod',
        allowAutoDeploy: false,
        requireExplicitVersion: true,
        blockExternalExposure: false,
        allowedProfileIds: [],
        allowedScmProviders: [],
        allowedRegistryProviders: [],
        allowedSecretProviders: [],
        allowedSourceTypes: ['registry'],
        allowedRegistries: [],
        allowedStrategies: ['rolling', 'blue-green'],
        maxReplicas: 6,
      },
    ],
  },
  {
    id: 'production-internal-only',
    label: 'Production Internal Only',
    description: 'Keep production traffic private by blocking external rule publication.',
    rules: [
      {
        environment: 'prod',
        allowAutoDeploy: false,
        requireExplicitVersion: true,
        blockExternalExposure: true,
        allowedProfileIds: [],
        allowedScmProviders: [],
        allowedRegistryProviders: [],
        allowedSecretProviders: [],
        allowedSourceTypes: ['registry'],
        allowedRegistries: [],
        allowedStrategies: ['rolling', 'blue-green'],
        maxReplicas: 6,
      },
    ],
  },
];

const createDefaultDeployPolicyRule = (): DeployPolicyRule => ({
  environment: 'prod',
  allowAutoDeploy: false,
  requireExplicitVersion: true,
  blockExternalExposure: false,
  allowedProfileIds: [],
  allowedScmProviders: [],
  allowedRegistryProviders: [],
  allowedSecretProviders: [],
  allowedSourceTypes: [],
  allowedRegistries: [],
  allowedStrategies: ['rolling'],
  maxReplicas: 0,
});

const renderAuditResourceIcon = (resourceType: string) => {
  switch (resourceType) {
    case 'deploy':
      return <Rocket className="w-4 h-4" />;
    case 'rule':
      return <Globe className="w-4 h-4" />;
    case 'service':
      return <AlertCircle className="w-4 h-4" />;
    case 'team':
      return <Users className="w-4 h-4" />;
    case 'settings':
      return <Settings className="w-4 h-4" />;
    case 'user':
      return <Shield className="w-4 h-4" />;
    case 'approval':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'operation':
      return <RefreshCw className="w-4 h-4" />;
    case 'worker':
      return <Bot className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

const GovernancePage = () => {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [settings, setSettings] = useState<GovernanceSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<Service[]>([]);
  const [temporaryExceptions, setTemporaryExceptions] = useState<GovernanceTemporaryException[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExceptionSaving, setIsExceptionSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<GovernanceTab>('approvals');

  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditResourceFilter, setAuditResourceFilter] = useState<AuditResourceFilter>('all');
  const [auditDateRange, setAuditDateRange] = useState<AuditDateRange>('all');
  const [auditPerformerFilter, setAuditPerformerFilter] = useState<string>('all');
  const [simulationEnvironment, setSimulationEnvironment] = useState('prod');
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResults, setSimulationResults] = useState<PolicySimulationResult[]>([]);
  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [exceptionForm, setExceptionForm] = useState(buildDefaultExceptionForm());

  // Review modal state
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const updateDeployPolicyRule = (index: number, patch: Partial<DeployPolicyRule>) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        deployPolicy: {
          ...prev.deployPolicy,
          rules: prev.deployPolicy.rules.map((rule, ruleIndex) =>
            ruleIndex === index ? { ...rule, ...patch } : rule
          ),
        },
      };
    });
  };

  const addDeployPolicyRule = () => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        deployPolicy: {
          ...prev.deployPolicy,
          rules: [
            ...prev.deployPolicy.rules,
            {
              ...createDefaultDeployPolicyRule(),
            },
          ],
        },
      };
    });
  };

  const seedStarterDeployPolicyRule = () => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        deployPolicy: {
          ...prev.deployPolicy,
          enabled: true,
          rules: prev.deployPolicy.rules.length > 0 ? prev.deployPolicy.rules : [createDefaultDeployPolicyRule()],
        },
      };
    });
  };

  const removeDeployPolicyRule = (index: number) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        deployPolicy: {
          ...prev.deployPolicy,
          rules: prev.deployPolicy.rules.filter((_, ruleIndex) => ruleIndex !== index),
        },
      };
    });
  };

  const applyDeployPolicyPreset = (rules: DeployPolicyRule[]) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        deployPolicy: {
          ...prev.deployPolicy,
          enabled: true,
          rules,
        },
      };
    });
  };

  const applyPolicyPack = (packId: string) => {
    setSettings(prev => {
      if (!prev) return prev;
      const pack = GOVERNANCE_POLICY_PACKS.find((item) => item.id === packId);
      if (!pack) return prev;
      return applyGovernancePolicyPack(prev, pack);
    });
  };

  const runPolicySimulation = async () => {
    setSimulationLoading(true);
    try {
      const services = await fetchServices();
      setServicesCatalog(services);
      const results = await Promise.all(
        services.map(async (service: Service): Promise<PolicySimulationResult> => {
          const sourceType = service.sourceType?.trim()
            ? service.sourceType
            : service.repoUrl?.trim()
              ? 'git'
              : service.dockerImage?.trim()
                ? 'registry'
                : 'unknown';
          const preflight = await fetchServiceDeployPolicyCheck(service.id, simulationEnvironment);
          if (!preflight) {
            return {
              serviceId: service.id,
              serviceName: service.name,
              projectId: service.projectId,
              sourceType,
              managementMode: service.managementMode ?? 'managed',
              state: 'unavailable',
              summary: 'Releasea could not evaluate the current deploy policy for this service.',
              violations: [],
              dryRun: false,
            };
          }

          const violations = preflight.violations ?? [];
          const exceptionsApplied = preflight.exceptionsApplied ?? [];
          const dryRun = preflight.dryRun === true;
          return {
            serviceId: service.id,
            serviceName: service.name,
            projectId: service.projectId,
            sourceType,
            managementMode: service.managementMode ?? 'managed',
            state:
              violations.length === 0
                ? exceptionsApplied.length > 0
                  ? 'warning'
                  : 'clear'
                : dryRun
                  ? 'warning'
                  : 'blocked',
            summary:
              violations.length === 0
                ? exceptionsApplied.length > 0
                  ? `Temporarily excepted: ${exceptionsApplied.map((item) => item.reason).filter(Boolean).join('; ')}`
                  : 'No policy blockers for the selected environment.'
                : dryRun
                  ? `Dry-run warnings: ${summarizeDeployPolicyViolations(violations)}`
                  : summarizeDeployPolicyViolations(violations),
            violations,
            dryRun,
          };
        }),
      );

      const rank: Record<PolicySimulationState, number> = {
        blocked: 0,
        warning: 1,
        unavailable: 2,
        clear: 3,
      };
      results.sort((left, right) => {
        const rankDelta = rank[left.state] - rank[right.state];
        if (rankDelta !== 0) return rankDelta;
        return left.serviceName.localeCompare(right.serviceName);
      });
      setSimulationResults(results);
    } catch (error) {
      toast({
        title: 'Simulation failed',
        description: error instanceof Error ? error.message : 'Unable to evaluate the current policy against services.',
        variant: 'destructive',
      });
    } finally {
      setSimulationLoading(false);
    }
  };

  const openExceptionDialog = () => {
    setExceptionForm(buildDefaultExceptionForm(servicesCatalog[0]?.id ?? ''));
    setIsExceptionDialogOpen(true);
  };

  const handleCreateException = async () => {
    if (!exceptionForm.serviceId.trim() || !exceptionForm.reason.trim() || !exceptionForm.expiresAt.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Select a service, define an expiry, and add a reason for the temporary exception.',
        variant: 'destructive',
      });
      return;
    }

    const expiresAt = new Date(exceptionForm.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      toast({
        title: 'Invalid expiration',
        description: 'Use a valid expiration date and time for the temporary exception.',
        variant: 'destructive',
      });
      return;
    }

    setIsExceptionSaving(true);
    try {
      await createGovernanceException({
        policy: 'deploy-policy',
        serviceId: exceptionForm.serviceId,
        environment: exceptionForm.environment,
        codes: parsePolicyList(exceptionForm.codes),
        reason: exceptionForm.reason.trim(),
        expiresAt: expiresAt.toISOString(),
      });
      const [exceptionsData, logsData] = await Promise.all([
        fetchGovernanceExceptions(),
        fetchAuditLogs(),
      ]);
      setTemporaryExceptions(exceptionsData);
      setAuditLogs(logsData);
      setIsExceptionDialogOpen(false);
      setExceptionForm(buildDefaultExceptionForm(servicesCatalog[0]?.id ?? ''));
      toast({
        title: 'Temporary exception created',
        description: 'Deploy policy enforcement will honor this exception until it expires or is revoked.',
      });
    } catch (error) {
      toast({
        title: 'Failed to create temporary exception',
        description: error instanceof Error ? error.message : 'Try again in a few moments.',
        variant: 'destructive',
      });
    } finally {
      setIsExceptionSaving(false);
    }
  };

  const handleRevokeException = async (exceptionId: string) => {
    try {
      await revokeGovernanceException(exceptionId);
      const [exceptionsData, logsData] = await Promise.all([
        fetchGovernanceExceptions(),
        fetchAuditLogs(),
      ]);
      setTemporaryExceptions(exceptionsData);
      setAuditLogs(logsData);
      toast({
        title: 'Temporary exception revoked',
        description: 'The exception is no longer applied to deploy policy evaluation.',
      });
    } catch (error) {
      toast({
        title: 'Failed to revoke temporary exception',
        description: error instanceof Error ? error.message : 'Try again in a few moments.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyDeployPolicyJSON = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            deployPolicy: settings.deployPolicy,
          },
          null,
          2,
        ),
      );
      toast({
        title: 'Policy copied',
        description: 'The current deploy policy JSON has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Unable to copy deploy policy JSON.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyPolicyDocument = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(buildGovernancePolicyDocument(settings), null, 2),
      );
      toast({
        title: 'Policy document copied',
        description: 'The versioned governance policy document has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Unable to copy policy document.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPolicyDocument = () => {
    if (!settings) return;
    try {
      const documentBody = JSON.stringify(buildGovernancePolicyDocument(settings), null, 2);
      const blob = new Blob([documentBody], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `releasea-governance-policy-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast({
        title: 'Policy document downloaded',
        description: 'The versioned governance policy document was downloaded as JSON.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download policy document.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [approvalsData, settingsData, logsData, servicesData, exceptionsData] = await Promise.all([
          fetchApprovalRequests(),
          fetchGovernanceSettings(),
          fetchAuditLogs(),
          fetchServices(),
          fetchGovernanceExceptions(),
        ]);
        setApprovals(approvalsData);
        setSettings(settingsData);
        setAuditLogs(logsData);
        setServicesCatalog(servicesData);
        setTemporaryExceptions(exceptionsData);
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
        const detailsText = log.details ? JSON.stringify(log.details).toLowerCase() : '';
        const matchesSearch =
          log.action.toLowerCase().includes(searchLower) ||
          log.resourceId.toLowerCase().includes(searchLower) ||
          log.resourceName.toLowerCase().includes(searchLower) ||
          log.performedBy.name.toLowerCase().includes(searchLower) ||
          log.performedBy.email.toLowerCase().includes(searchLower) ||
          (log.ipAddress ?? '').toLowerCase().includes(searchLower) ||
          detailsText.includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (auditActionFilter && !log.action.toLowerCase().includes(auditActionFilter.toLowerCase())) {
        return false;
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
  }, [auditLogs, auditSearch, auditActionFilter, auditResourceFilter, auditDateRange, auditPerformerFilter]);

  const simulationSummary = useMemo(() => ({
    total: simulationResults.length,
    blocked: simulationResults.filter((result) => result.state === 'blocked').length,
    warning: simulationResults.filter((result) => result.state === 'warning').length,
    unavailable: simulationResults.filter((result) => result.state === 'unavailable').length,
    clear: simulationResults.filter((result) => result.state === 'clear').length,
  }), [simulationResults]);
  const simulationFindings = useMemo(
    () => simulationResults.filter((result) => result.state !== 'clear'),
    [simulationResults],
  );
  const sortedTemporaryExceptions = useMemo(() => {
    const statusRank = (status: GovernanceTemporaryException['status']) => {
      switch (status) {
        case 'active':
          return 0;
        case 'expired':
          return 1;
        case 'revoked':
          return 2;
        default:
          return 3;
      }
    };
    return [...temporaryExceptions].sort((left, right) => {
      const rankDelta = statusRank(left.status) - statusRank(right.status);
      if (rankDelta !== 0) return rankDelta;
      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [temporaryExceptions]);

  const resetAuditFilters = () => {
    setAuditSearch('');
    setAuditActionFilter('');
    setAuditResourceFilter('all');
    setAuditDateRange('all');
    setAuditPerformerFilter('all');
  };

  const handleCopyAuditJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filteredAuditLogs, null, 2));
      toast({
        title: 'Audit JSON copied',
        description: 'The currently filtered audit feed was copied as formatted JSON.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Unable to copy the filtered audit feed.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadAuditCSV = () => {
    try {
      const escapeCSV = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const rows = [
        ['performedAt', 'action', 'resourceType', 'resourceId', 'resourceName', 'performedBy', 'ipAddress', 'details'],
        ...filteredAuditLogs.map((log) => [
          log.performedAt,
          log.action,
          log.resourceType,
          log.resourceId,
          log.resourceName,
          log.performedBy.name,
          log.ipAddress ?? '',
          log.details ? JSON.stringify(log.details) : '',
        ]),
      ];
      const csv = rows.map((row) => row.map((value) => escapeCSV(String(value ?? ''))).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `releasea-governance-audit-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast({
        title: 'Audit CSV downloaded',
        description: 'The currently filtered audit feed was downloaded as CSV.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download the filtered audit feed.',
        variant: 'destructive',
      });
    }
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
      const updatedSettings = await updateGovernanceSettings(settings);
      const refreshedAuditLogs = await fetchAuditLogs();
      setSettings(updatedSettings);
      setAuditLogs(refreshedAuditLogs);
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GovernanceTab)} className="space-y-6">
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
              {auditLogs.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {auditLogs.length}
                </Badge>
              )}
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
                  description="No pending approvals at the moment. Review policies or inspect the audit trail for recent platform activity."
                  actionLabel="Open policies"
                  onAction={() => setActiveTab('policies')}
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
                  title="Policy packs by environment tier"
                  description="Apply a complete governance baseline for common environment tiers, then tune individual rules."
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    {GOVERNANCE_POLICY_PACKS.map((pack) => (
                      <div
                        key={pack.id}
                        className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{pack.label}</p>
                            <Badge variant="outline" className="text-[10px] normal-case">
                              {pack.environmentTiers.join(' · ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{pack.description}</p>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>
                            Deploy approvals: {pack.settings.deployApproval.enabled
                              ? `${pack.settings.deployApproval.minApprovers} approver${pack.settings.deployApproval.minApprovers === 1 ? '' : 's'} for ${pack.settings.deployApproval.environments.join(', ')}`
                              : 'disabled'}
                          </p>
                          <p>
                            Deploy policy rules: {pack.settings.deployPolicy.rules.length}
                          </p>
                          <p>
                            Rule publication approval: {pack.settings.rulePublishApproval.enabled
                              ? pack.settings.rulePublishApproval.externalOnly
                                ? 'external only'
                                : 'all publications'
                              : 'disabled'}
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => applyPolicyPack(pack.id)}>
                          Apply pack
                        </Button>
                      </div>
                    ))}
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Policy simulation"
                  description="Evaluate the current policy against existing services before tightening enforcement."
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div className="grid gap-3 md:grid-cols-[220px_auto] md:items-end">
                        <div className="space-y-2">
                          <Label>Environment</Label>
                          <Select value={simulationEnvironment} onValueChange={setSimulationEnvironment}>
                            <SelectTrigger className="bg-muted/40">
                              <SelectValue placeholder="Select environment" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dev">Development</SelectItem>
                              <SelectItem value="staging">Staging</SelectItem>
                              <SelectItem value="prod">Production</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Simulation uses the same preflight contract that Service Details uses before deploy.
                        </div>
                      </div>
                      <Button type="button" variant="outline" className="gap-2" onClick={runPolicySimulation} disabled={simulationLoading}>
                        <RefreshCw className={cn('w-4 h-4', simulationLoading ? 'animate-spin' : '')} />
                        {simulationLoading ? 'Running simulation...' : 'Run simulation'}
                      </Button>
                    </div>

                    {simulationSummary.total > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">{simulationSummary.total} services</Badge>
                          <Badge variant="outline" className="border-success/30 bg-success/10 text-xs text-success">{simulationSummary.clear} clear</Badge>
                          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-xs text-warning">{simulationSummary.warning} warning</Badge>
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-xs text-destructive">{simulationSummary.blocked} blocked</Badge>
                          <Badge variant="outline" className="text-xs">{simulationSummary.unavailable} unavailable</Badge>
                        </div>

                        {simulationFindings.length === 0 ? (
                          <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-muted-foreground">
                            All simulated services are currently clear for {simulationEnvironment}.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {simulationFindings.map((result) => (
                              <div key={`${result.serviceId}:${simulationEnvironment}`} className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-2">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-foreground">{result.serviceName}</p>
                                      <Badge variant="outline" className="text-[10px] normal-case">{result.managementMode}</Badge>
                                      <Badge variant="outline" className="text-[10px] normal-case">{result.sourceType}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Project: {result.projectId}</p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] normal-case',
                                      result.state === 'blocked'
                                        ? 'border-destructive/30 text-destructive'
                                        : result.state === 'warning'
                                          ? 'border-warning/30 text-warning'
                                          : 'border-border/60 text-muted-foreground',
                                    )}
                                  >
                                    {result.state}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{result.summary}</p>
                                {result.violations.length > 0 ? (
                                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                    {result.violations.map((violation) => (
                                      <li key={`${result.serviceId}:${violation.environment}:${violation.code}`}>{violation.message}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Shield className="h-5 w-5 text-muted-foreground" />}
                        title="No simulation results yet"
                        description="Run a policy simulation to see which current services would be blocked or warned in the selected environment."
                        actionLabel="Run simulation"
                        onAction={runPolicySimulation}
                        tone="muted"
                      />
                    )}
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Temporary exceptions"
                  description="Create time-bound deploy-policy exceptions for specific services while migration or remediation work is in flight."
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Exceptions are scoped to one service and one environment, and can target all violations or specific policy codes.
                      </div>
                      <Button type="button" variant="outline" className="gap-2" onClick={openExceptionDialog} disabled={servicesCatalog.length === 0}>
                        <Plus className="w-4 h-4" />
                        New exception
                      </Button>
                    </div>

                    {servicesCatalog.length === 0 ? (
                      <EmptyState
                        icon={<Shield className="h-5 w-5 text-muted-foreground" />}
                        title="No services available for exceptions"
                        description="Create services first. Temporary exceptions are always scoped to an existing managed or observed service."
                        tone="muted"
                      />
                    ) : sortedTemporaryExceptions.length === 0 ? (
                      <EmptyState
                        icon={<Shield className="h-5 w-5 text-muted-foreground" />}
                        title="No temporary exceptions"
                        description="Use exceptions sparingly for controlled migrations or short-lived operational windows."
                        actionLabel="Create exception"
                        onAction={openExceptionDialog}
                        tone="muted"
                      />
                    ) : (
                      <div className="space-y-3">
                        {sortedTemporaryExceptions.map((exception) => (
                          <div key={exception.id} className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{exception.serviceName}</p>
                                  <Badge variant="outline" className="text-[10px] normal-case">{exception.environment}</Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] normal-case',
                                      exception.status === 'active'
                                        ? 'border-warning/30 text-warning'
                                        : exception.status === 'expired'
                                          ? 'border-border/60 text-muted-foreground'
                                          : 'border-destructive/30 text-destructive',
                                    )}
                                  >
                                    {exception.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {exception.codes.includes('*') ? 'All policy violations' : exception.codes.join(', ')}
                                </p>
                              </div>
                              {exception.status === 'active' ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-muted-foreground"
                                  onClick={() => handleRevokeException(exception.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Revoke
                                </Button>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{exception.reason}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Expires {format(parseISO(exception.expiresAt), 'PPP p')}</span>
                              <span>Created {format(parseISO(exception.createdAt), 'PPP p')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SettingsSection>

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
                  title="Deploy policy rules"
                  description="Code-like environment rules evaluated before deploy, promote, or external publication is queued"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">Enable deploy policy</p>
                        <p className="text-xs text-muted-foreground">Block deploys that violate environment-specific rules before the worker queue is used</p>
                      </div>
                      <Switch
                        checked={settings.deployPolicy.enabled}
                        onCheckedChange={(checked) =>
                          setSettings(prev => prev ? {
                            ...prev,
                            deployPolicy: {
                              ...prev.deployPolicy,
                              enabled: checked,
                              rules: checked && (prev.deployPolicy.rules?.length ?? 0) === 0
                                ? [createDefaultDeployPolicyRule()]
                                : (prev.deployPolicy.rules ?? []),
                            }
                          } : prev)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">Dry-run mode</p>
                        <p className="text-xs text-muted-foreground">Evaluate and audit policy violations without blocking deploy or publish execution.</p>
                      </div>
                      <Switch
                        checked={settings.deployPolicy.dryRun}
                        onCheckedChange={(checked) =>
                          setSettings(prev => prev ? {
                            ...prev,
                            deployPolicy: {
                              ...prev.deployPolicy,
                              dryRun: checked,
                            }
                          } : prev)
                        }
                        disabled={!settings.deployPolicy.enabled}
                      />
                    </div>

                    {settings.deployPolicy.enabled && (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Policy rules</p>
                            <p className="text-xs text-muted-foreground">One rule per environment. Auto deploy, version pinning, source type, registry host, strategy type, replica count, and external exposure are evaluated before queueing.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleCopyPolicyDocument}>
                              Copy document
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleDownloadPolicyDocument}>
                              Download JSON
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleCopyDeployPolicyJSON}>
                              Copy JSON
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addDeployPolicyRule}>
                              <Plus className="w-4 h-4" />
                              Add rule
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Presets</p>
                            <p className="text-xs text-muted-foreground">Apply a starting point, then tune the rules for your platform.</p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {DEPLOY_POLICY_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyDeployPolicyPreset(preset.rules)}
                                className="rounded-lg border border-border/60 bg-background/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                              >
                                <p className="text-sm font-medium text-foreground">{preset.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                          {(settings.deployPolicy.rules ?? []).length === 0 ? (
                            <EmptyState
                              icon={<Shield className="h-5 w-5 text-muted-foreground" />}
                              title="No policy rules configured"
                              description="Enable the deploy policy and add a rule for environments such as production."
                              actionLabel="Add starter rule"
                              onAction={seedStarterDeployPolicyRule}
                              tone="muted"
                            />
                          ) : (
                            <div className="space-y-3">
                            {(settings.deployPolicy.rules ?? []).map((rule, index) => (
                              <div
                                key={`${rule.environment}-${index}`}
                                className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">Rule {index + 1}</p>
                                <p className="text-xs text-muted-foreground">Environment-specific deploy and exposure guardrails.</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 text-muted-foreground"
                                    onClick={() => removeDeployPolicyRule(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                  </Button>
                                </div>

                                <SettingsGrid columns={2}>
                                  <div className="space-y-2">
                                    <Label>Environment</Label>
                                    <Input
                                      value={rule.environment}
                                      onChange={(e) => updateDeployPolicyRule(index, { environment: e.target.value })}
                                      className="bg-muted/40"
                                      placeholder="prod"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed source types</Label>
                                    <Input
                                      value={rule.allowedSourceTypes.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedSourceTypes: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="git, registry"
                                    />
                                    <p className="text-xs text-muted-foreground">Leave empty to allow any source type.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed runtime profiles</Label>
                                    <Input
                                      value={rule.allowedProfileIds.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedProfileIds: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="rp-medium, rp-large"
                                    />
                                    <p className="text-xs text-muted-foreground">Leave empty to allow any runtime profile.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed registries</Label>
                                    <Input
                                      value={rule.allowedRegistries.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedRegistries: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="ghcr.io, us-central1-docker.pkg.dev"
                                    />
                                    <p className="text-xs text-muted-foreground">Leave empty to allow any registry host.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed SCM providers</Label>
                                    <Input
                                      value={rule.allowedScmProviders.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedScmProviders: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="github, gitlab"
                                    />
                                    <p className="text-xs text-muted-foreground">Applied to Git-based deploys only.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed registry providers</Label>
                                    <Input
                                      value={rule.allowedRegistryProviders.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedRegistryProviders: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="ghcr, docker, ecr"
                                    />
                                    <p className="text-xs text-muted-foreground">Applied to registry-sourced deploys.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed secret providers</Label>
                                    <Input
                                      value={rule.allowedSecretProviders.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedSecretProviders: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="vault, aws, gcp"
                                    />
                                    <p className="text-xs text-muted-foreground">Applied when the service uses secret references.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Allowed strategies</Label>
                                    <Input
                                      value={rule.allowedStrategies.join(', ')}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          allowedStrategies: parsePolicyList(e.target.value),
                                        })
                                      }
                                      className="bg-muted/40"
                                      placeholder="rolling, canary"
                                    />
                                    <p className="text-xs text-muted-foreground">Leave empty to allow any deploy strategy.</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Max replicas</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={rule.maxReplicas}
                                      onChange={(e) =>
                                        updateDeployPolicyRule(index, {
                                          maxReplicas: Math.max(0, parseInt(e.target.value, 10) || 0),
                                        })
                                      }
                                      className="bg-muted/40"
                                    />
                                    <p className="text-xs text-muted-foreground">Use `0` for no replica limit.</p>
                                  </div>
                                </SettingsGrid>

                                <div className="grid gap-3 border-t border-border/50 pt-3 md:grid-cols-3">
                                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">Allow auto deploy</p>
                                      <p className="text-xs text-muted-foreground">When disabled, auto-triggered deploys are rejected for this environment.</p>
                                    </div>
                                    <Switch
                                      checked={rule.allowAutoDeploy}
                                      onCheckedChange={(checked) => updateDeployPolicyRule(index, { allowAutoDeploy: checked })}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">Require explicit version</p>
                                      <p className="text-xs text-muted-foreground">Reject deploys that rely on `latest`, `head`, or an empty version.</p>
                                    </div>
                                    <Switch
                                      checked={rule.requireExplicitVersion}
                                      onCheckedChange={(checked) => updateDeployPolicyRule(index, { requireExplicitVersion: checked })}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">Block external exposure</p>
                                      <p className="text-xs text-muted-foreground">Reject rule publications that target external gateways in this environment.</p>
                                    </div>
                                    <Switch
                                      checked={rule.blockExternalExposure}
                                      onCheckedChange={(checked) => updateDeployPolicyRule(index, { blockExternalExposure: checked })}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
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
                  placeholder="Search actions, resources, IDs, users, IPs, details..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="w-4 h-4" />
                      Action
                      {auditActionFilter && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                          1
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-2" align="end">
                    <Label className="text-xs text-muted-foreground">Action contains</Label>
                    <Input
                      value={auditActionFilter}
                      onChange={(event) => setAuditActionFilter(event.target.value)}
                      placeholder="deploy, governance, worker..."
                    />
                  </PopoverContent>
                </Popover>

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
                          <SelectItem value="operation">Operation</SelectItem>
                          <SelectItem value="worker">Worker</SelectItem>
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
                      {auditDateRange !== 'all' && (
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

                {(auditSearch || auditActionFilter || auditResourceFilter !== 'all' || auditDateRange !== 'all' || auditPerformerFilter !== 'all') && (
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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyAuditJSON} disabled={filteredAuditLogs.length === 0}>
                  <FileText className="w-4 h-4" />
                  Copy JSON
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadAuditCSV} disabled={filteredAuditLogs.length === 0}>
                  <Download className="w-4 h-4" />
                  Download CSV
                </Button>
              </div>
            </div>

            <SettingsSection
              title="Activity log"
              description="Recent actions performed on the platform"
            >
              {filteredAuditLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/60 p-10">
                  <EmptyState
                    icon={<Search className="h-5 w-5 text-muted-foreground" />}
                    title={auditLogs.length === 0 ? 'No audit entries yet' : 'No entries found'}
                    description={auditLogs.length === 0 ? 'Platform and governance events appear here after deploys, service or rule changes, approvals, and policy blocks.' : 'Try adjusting your filters or search term.'}
                    actionLabel={auditLogs.length === 0 ? 'Open services' : 'Reset filters'}
                    onAction={auditLogs.length === 0 ? () => navigate('/services') : resetAuditFilters}
                    tone="muted"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAuditLogs.map((log) => {
                    const detailsPreview = log.details
                      ? redactSensitiveText(JSON.stringify(log.details), {
                          maskEmails: true,
                          maskIPs: true,
                          maxLength: 80,
                        })
                      : '';
                    return (
                      <div
                        key={log.id}
                        className="flex items-start justify-between py-3 px-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                            {renderAuditResourceIcon(log.resourceType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {sanitizeTextForRender(log.action.replace(/\./g, ' ').replace(/_/g, ' '), { maxLength: 120 })}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {sanitizeTextForRender(log.resourceType, { maxLength: 32 })}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {sanitizeTextForRender(log.resourceName, { maxLength: 140 })} • {sanitizeTextForRender(log.performedBy.name, { maxLength: 80 })}
                            </p>
                            {detailsPreview && (
                              <p className="text-xs text-muted-foreground/80 mt-1 font-mono">{detailsPreview}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.performedAt), 'MMM d, HH:mm')}
                          </p>
                          {log.ipAddress && (
                            <p className="text-xs text-muted-foreground/60 font-mono">
                              {maskIPAddress(log.ipAddress)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SettingsSection>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isExceptionDialogOpen} onOpenChange={setIsExceptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Temporary Exception</DialogTitle>
            <DialogDescription>
              Use a short-lived exception when a service must ship while remediation or migration work is still in progress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select
                value={exceptionForm.serviceId}
                onValueChange={(value) => setExceptionForm((prev) => ({ ...prev, serviceId: value }))}
              >
                <SelectTrigger className="bg-muted/40">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {servicesCatalog.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={exceptionForm.environment}
                  onValueChange={(value) => setExceptionForm((prev) => ({ ...prev, environment: value }))}
                >
                  <SelectTrigger className="bg-muted/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input
                  type="datetime-local"
                  value={exceptionForm.expiresAt}
                  onChange={(event) => setExceptionForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                  className="bg-muted/40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Policy Codes</Label>
              <Input
                value={exceptionForm.codes}
                onChange={(event) => setExceptionForm((prev) => ({ ...prev, codes: event.target.value }))}
                className="bg-muted/40"
                placeholder="* or explicit-version-required, registry-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Use <code>*</code> to cover all deploy-policy violations for this service and environment.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={exceptionForm.reason}
                onChange={(event) => setExceptionForm((prev) => ({ ...prev, reason: event.target.value }))}
                rows={4}
                placeholder="Explain why this service needs a temporary exception and what work is underway to remove it."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExceptionDialogOpen(false)} disabled={isExceptionSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateException} disabled={isExceptionSaving}>
              {isExceptionSaving ? 'Creating...' : 'Create exception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
