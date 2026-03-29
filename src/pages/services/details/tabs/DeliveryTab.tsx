import { TabsContent } from '@/components/ui/tabs';
import type { DeployPolicyPreflight } from '@/types/governance';
import type { ReleaseIntelligenceSummary } from '@/lib/release-intelligence';
import type { ManagementTransitionRequirement } from '@/pages/services/details/ManagementModeTransitionDialog';
import type {
  Service,
  ServiceDesiredStateValidation,
  ServiceGitOpsDriftStatus,
  ServiceGitOpsLayoutPreset,
  ServiceGitOpsRepositoryPolicyCheck,
  ServiceGitOpsTimelineEvent,
} from '@/types/releasea';
import { buildServiceReadinessScorecard } from '@/lib/service-readiness';
import { ReadinessScorecard } from './delivery/ReadinessScorecard';
import { GitOpsDeliverySection } from './delivery/GitOpsDeliverySection';
import { DeployPolicySection } from './delivery/DeployPolicySection';
import { ReleaseIntelligenceSection } from './delivery/ReleaseIntelligenceSection';
import { ObservedModeSection } from './delivery/ObservedModeSection';

type DeliveryTabProps = {
  service: Service;
  viewEnvLabel: string;
  managementTransitionRequirements: ManagementTransitionRequirement[];
  deployPolicyPreflight: DeployPolicyPreflight | null;
  deployPolicyPreflightLoading: boolean;
  gitOpsRepositoryPolicyCheck: ServiceGitOpsRepositoryPolicyCheck | null;
  gitOpsRepositoryPolicyCheckLoading: boolean;
  gitOpsDrift: ServiceGitOpsDriftStatus | null;
  gitOpsDriftLoading: boolean;
  gitOpsLayoutPresets?: ServiceGitOpsLayoutPreset[];
  gitOpsLayoutPresetsLoading?: boolean;
  gitOpsTimeline?: ServiceGitOpsTimelineEvent[];
  gitOpsTimelineLoading: boolean;
  desiredStateValidation: ServiceDesiredStateValidation | null;
  desiredStateValidationLoading: boolean;
  releaseIntelligence: ReleaseIntelligenceSummary | null;
};

export const DeliveryTab = ({
  service,
  viewEnvLabel,
  managementTransitionRequirements,
  deployPolicyPreflight,
  deployPolicyPreflightLoading,
  gitOpsRepositoryPolicyCheck,
  gitOpsRepositoryPolicyCheckLoading,
  gitOpsDrift,
  gitOpsDriftLoading,
  gitOpsLayoutPresets = [],
  gitOpsLayoutPresetsLoading = false,
  gitOpsTimeline = [],
  gitOpsTimelineLoading = false,
  desiredStateValidation,
  desiredStateValidationLoading,
  releaseIntelligence,
}: DeliveryTabProps) => {
  const readinessScorecard = buildServiceReadinessScorecard({
    service,
    requirements: managementTransitionRequirements,
    deployPolicyPreflight,
    gitOpsRepositoryPolicyCheck,
    gitOpsDrift,
    releaseIntelligence,
  });

  const managementMode = service.managementMode ?? 'managed';

  return (
    <TabsContent value="delivery" className="space-y-6">
      {/* Row 1: Readiness + GitOps side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ReadinessScorecard
          scorecard={readinessScorecard}
          loadingHints={{
            gitOpsDrift: gitOpsDriftLoading,
            gitOpsRepoPolicy: gitOpsRepositoryPolicyCheckLoading,
            deployPolicy: deployPolicyPreflightLoading,
          }}
        />
        <GitOpsDeliverySection
          service={service}
          gitOpsRepositoryPolicyCheck={gitOpsRepositoryPolicyCheck}
          gitOpsRepositoryPolicyCheckLoading={gitOpsRepositoryPolicyCheckLoading}
          gitOpsDrift={gitOpsDrift}
          gitOpsDriftLoading={gitOpsDriftLoading}
          gitOpsLayoutPresets={gitOpsLayoutPresets}
          gitOpsLayoutPresetsLoading={gitOpsLayoutPresetsLoading}
          gitOpsTimeline={gitOpsTimeline}
          gitOpsTimelineLoading={gitOpsTimelineLoading}
          desiredStateValidation={desiredStateValidation}
          desiredStateValidationLoading={desiredStateValidationLoading}
        />
      </div>

      {/* Observed mode banner (conditional) */}
      {managementMode === 'observed' && <ObservedModeSection />}

      {/* Row 2: Policy + Intelligence side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeployPolicySection
          viewEnvLabel={viewEnvLabel}
          deployPolicyPreflight={deployPolicyPreflight}
          deployPolicyPreflightLoading={deployPolicyPreflightLoading}
        />
        <ReleaseIntelligenceSection releaseIntelligence={releaseIntelligence} />
      </div>
    </TabsContent>
  );
};
