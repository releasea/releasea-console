import type { Deploy, EnvironmentConfig, Metrics } from '@/types/releasea';
import { isSuccessfulDeployStatus, parseDeployTimestamp } from '@/lib/deploy-status';
import { resolveEnvironmentSloTargets } from '@/lib/environments';

export type ReleaseIntelligenceState = 'meeting' | 'at-risk' | 'breached' | 'unknown';
export type ReleaseRollbackRecommendation = 'stable' | 'watch' | 'rollback' | 'insufficient-data';
export type ReleaseRollbackConfidence = 'high' | 'medium' | 'low';

export interface ReleaseIntelligenceSummary {
  latestReleaseLabel: string;
  previousReleaseLabel?: string;
  latestDeployAt: string;
  previousDeployAt?: string;
  deployImpactTimeline: Array<{
    deployId: string;
    releaseLabel: string;
    deployedAt: string;
    impact: 'improved' | 'steady' | 'regressed' | 'insufficient-data';
    latencyBeforeMs: number | null;
    latencyAfterMs: number | null;
    errorRateBeforePct: number | null;
    errorRateAfterPct: number | null;
    summary: string;
  }>;
  comparison: {
    available: boolean;
    verdict: 'improved' | 'steady' | 'regressed' | 'insufficient-data';
    summary: string;
    latencyChangePct: number | null;
    errorRateChangePct: number | null;
    availabilityChangePctPoints: number | null;
  };
  slo: {
    availabilityPct: number | null;
    errorRatePct: number | null;
    latencyP95AvgMs: number | null;
    availabilityTargetPct: number;
    latencyTargetMs: number;
    availabilityState: ReleaseIntelligenceState;
    latencyState: ReleaseIntelligenceState;
    overallState: ReleaseIntelligenceState;
  };
  baseline: {
    available: boolean;
    beforeSamples: number;
    afterSamples: number;
    latencyBeforeMs: number | null;
    latencyAfterMs: number | null;
    latencyChangePct: number | null;
    errorRateBeforePct: number | null;
    errorRateAfterPct: number | null;
    errorRateChangePct: number | null;
    requestsAfterAvg: number | null;
  };
  rollback: {
    recommendation: ReleaseRollbackRecommendation;
    confidence: ReleaseRollbackConfidence;
    factors: string[];
    message: string;
  };
  anomalies: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    detail: string;
  }>;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null, digits = 1): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildReleaseLabel(deploy: Deploy): string {
  const commit = deploy.commit?.trim();
  if (commit) return commit.slice(0, 12);
  const branch = deploy.branch?.trim();
  if (branch) return branch;
  return deploy.id;
}

function resolveState(value: number | null, healthyMaxOrMin: number, atRiskMaxOrMin: number, inverse = false): ReleaseIntelligenceState {
  if (value == null) return 'unknown';
  if (inverse) {
    if (value >= healthyMaxOrMin) return 'meeting';
    if (value >= atRiskMaxOrMin) return 'at-risk';
    return 'breached';
  }
  if (value <= healthyMaxOrMin) return 'meeting';
  if (value <= atRiskMaxOrMin) return 'at-risk';
  return 'breached';
}

function pickWorstState(states: ReleaseIntelligenceState[]): ReleaseIntelligenceState {
  if (states.includes('breached')) return 'breached';
  if (states.includes('at-risk')) return 'at-risk';
  if (states.includes('meeting')) return 'meeting';
  return 'unknown';
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function computeErrorRatePct(twoXX: number[], fourXX: number[], fiveXX: number[]): number | null {
  const total = sum(twoXX) + sum(fourXX) + sum(fiveXX);
  if (total <= 0) return null;
  return (sum(fiveXX) / total) * 100;
}

function computeAvailabilityPct(errorRatePct: number | null): number | null {
  if (errorRatePct == null) return null;
  return 100 - errorRatePct;
}

function subset(values: number[], indexes: number[]): number[] {
  return indexes.map((index) => values[index]).filter((value) => Number.isFinite(value));
}

function percentageChange(before: number | null, after: number | null): number | null {
  if (before == null || after == null) return null;
  if (before === 0) {
    return after === 0 ? 0 : 100;
  }
  return ((after - before) / before) * 100;
}

function buildDeployImpactTimeline(deploys: Deploy[], metrics: Metrics, timestamps: number[]) {
  const entries = deploys.slice(0, 5).map((deploy, index) => {
    const deployTs = parseDeployTimestamp(deploy.startedAt, deploy.createdAt, deploy.updatedAt);
    const newerDeployTs =
      index === 0 ? Number.POSITIVE_INFINITY : parseDeployTimestamp(deploys[index - 1].startedAt, deploys[index - 1].createdAt, deploys[index - 1].updatedAt);
    const olderDeployTs =
      index < deploys.length - 1
        ? parseDeployTimestamp(deploys[index + 1].startedAt, deploys[index + 1].createdAt, deploys[index + 1].updatedAt)
        : Number.NEGATIVE_INFINITY;

    const beforeIndexes = timestamps
      .map((value, idx) => ({ value, idx }))
      .filter((entry) => Number.isFinite(entry.value) && entry.value < deployTs && entry.value >= olderDeployTs)
      .map((entry) => entry.idx);
    const afterIndexes = timestamps
      .map((value, idx) => ({ value, idx }))
      .filter((entry) => Number.isFinite(entry.value) && entry.value >= deployTs && entry.value < newerDeployTs)
      .map((entry) => entry.idx);

    const latencyBefore = round(average(subset(metrics.latencyP95, beforeIndexes)));
    const latencyAfter = round(average(subset(metrics.latencyP95, afterIndexes)));
    const errorBefore = round(
      computeErrorRatePct(
        subset(metrics.statusCodes?.['2xx'] ?? [], beforeIndexes),
        subset(metrics.statusCodes?.['4xx'] ?? [], beforeIndexes),
        subset(metrics.statusCodes?.['5xx'] ?? [], beforeIndexes),
      ),
      2,
    );
    const errorAfter = round(
      computeErrorRatePct(
        subset(metrics.statusCodes?.['2xx'] ?? [], afterIndexes),
        subset(metrics.statusCodes?.['4xx'] ?? [], afterIndexes),
        subset(metrics.statusCodes?.['5xx'] ?? [], afterIndexes),
      ),
      2,
    );

    const latencyChangePct = round(percentageChange(latencyBefore, latencyAfter), 1);
    const errorChangePct = round(percentageChange(errorBefore, errorAfter), 1);

    let impact: ReleaseIntelligenceSummary['deployImpactTimeline'][number]['impact'] = 'steady';
    let summary = 'Telemetry remained broadly consistent after this deploy.';
    if (beforeIndexes.length < 2 || afterIndexes.length < 2) {
      impact = 'insufficient-data';
      summary = 'Not enough telemetry exists before and after this deploy to classify its impact.';
    } else if ((errorAfter ?? 0) > (errorBefore ?? 0)+0.25 || (latencyChangePct ?? 0) >= 20) {
      impact = 'regressed';
      summary = 'Latency or 5xx rate regressed after this deploy.';
    } else if ((latencyChangePct ?? 0) <= -10 || (errorChangePct ?? 0) <= -10) {
      impact = 'improved';
      summary = 'Latency or 5xx rate improved after this deploy.';
    }

    return {
      deployId: deploy.id,
      releaseLabel: buildReleaseLabel(deploy),
      deployedAt: deploy.startedAt,
      impact,
      latencyBeforeMs: latencyBefore,
      latencyAfterMs: latencyAfter,
      errorRateBeforePct: errorBefore,
      errorRateAfterPct: errorAfter,
      summary,
    };
  });

  return entries;
}

export function buildReleaseIntelligenceSummary(
  deploys: Deploy[],
  metrics: Metrics | null,
  environmentConfig?: EnvironmentConfig | null,
): ReleaseIntelligenceSummary | null {
  const successfulDeploys = deploys.filter((deploy) => isSuccessfulDeployStatus(deploy.status));
  if (!successfulDeploys.length || !metrics) {
    return null;
  }
  const sloTargets = resolveEnvironmentSloTargets(environmentConfig);

  const latestDeploy = successfulDeploys[0];
  const previousDeploy = successfulDeploys[1];
  const latencyAvg = round(average(metrics.latencyP95));
  const errorRatePct = round(
    computeErrorRatePct(
      metrics.statusCodes?.['2xx'] ?? [],
      metrics.statusCodes?.['4xx'] ?? [],
      metrics.statusCodes?.['5xx'] ?? [],
    ),
    2,
  );
  const availabilityPct = round(computeAvailabilityPct(errorRatePct), 3);

  const availabilityState = resolveState(
    availabilityPct,
    sloTargets.availabilityPct,
    Math.max(sloTargets.availabilityPct-0.5, 0),
    true,
  );
  const latencyState = resolveState(
    latencyAvg,
    sloTargets.latencyP95Ms,
    Math.max(sloTargets.latencyP95Ms * 1.5, sloTargets.latencyP95Ms + 100),
  );
  const overallState = pickWorstState([availabilityState, latencyState]);

  const timestamps = metrics.timestamps.map((value) => Date.parse(value));
  const latestDeployTs = parseDeployTimestamp(
    latestDeploy.startedAt,
    latestDeploy.createdAt,
    latestDeploy.updatedAt,
  );
  const beforeIndexes = timestamps
    .map((value, index) => ({ value, index }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value < latestDeployTs)
    .map((entry) => entry.index);
  const afterIndexes = timestamps
    .map((value, index) => ({ value, index }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value >= latestDeployTs)
    .map((entry) => entry.index);

  const latencyBefore = round(average(subset(metrics.latencyP95, beforeIndexes)));
  const latencyAfter = round(average(subset(metrics.latencyP95, afterIndexes)));
  const errorBefore = round(
    computeErrorRatePct(
      subset(metrics.statusCodes?.['2xx'] ?? [], beforeIndexes),
      subset(metrics.statusCodes?.['4xx'] ?? [], beforeIndexes),
      subset(metrics.statusCodes?.['5xx'] ?? [], beforeIndexes),
    ),
    2,
  );
  const errorAfter = round(
    computeErrorRatePct(
      subset(metrics.statusCodes?.['2xx'] ?? [], afterIndexes),
      subset(metrics.statusCodes?.['4xx'] ?? [], afterIndexes),
      subset(metrics.statusCodes?.['5xx'] ?? [], afterIndexes),
    ),
    2,
  );
  const requestsAfterAvg = round(average(subset(metrics.requests, afterIndexes)));
  const latencyChangePct = round(percentageChange(latencyBefore, latencyAfter), 1);
  const errorChangePct = round(percentageChange(errorBefore, errorAfter), 1);
  const availabilityBefore = round(computeAvailabilityPct(errorBefore), 3);
  const availabilityAfter = round(computeAvailabilityPct(errorAfter), 3);
  const availabilityChangePctPoints =
    availabilityBefore == null || availabilityAfter == null ? null : round(availabilityAfter - availabilityBefore, 3);
  const baselineAvailable = beforeIndexes.length >= 2 && afterIndexes.length >= 2;

  let rollbackRecommendation: ReleaseRollbackRecommendation = 'stable';
  let rollbackMessage = 'Recent telemetry looks stable after the latest deploy.';
  let rollbackConfidence: ReleaseRollbackConfidence = 'medium';
  const rollbackFactors: string[] = [];
  if (!baselineAvailable) {
    rollbackRecommendation = 'insufficient-data';
    rollbackMessage = 'Need telemetry on both sides of the latest deploy to produce a rollback recommendation.';
    rollbackConfidence = 'low';
    rollbackFactors.push('Telemetry before and after the latest deploy is incomplete.');
  } else if ((errorAfter ?? 0) >= 2 || (latencyChangePct ?? 0) >= 50) {
    rollbackRecommendation = 'rollback';
    rollbackMessage = 'Recent telemetry degraded sharply after the latest deploy. Prepare rollback or mitigation now.';
    rollbackFactors.push('The latest deploy introduced a sharp latency or 5xx regression.');
  } else if ((errorAfter ?? 0) > (errorBefore ?? 0)+0.25 || (latencyChangePct ?? 0) >= 20) {
    rollbackRecommendation = 'watch';
    rollbackMessage = 'Recent telemetry regressed after the latest deploy. Watch closely before promoting more traffic.';
    rollbackFactors.push('The latest deploy regressed latency or 5xx rate versus the prior baseline.');
  } else if ((requestsAfterAvg ?? 0) < 1) {
    rollbackRecommendation = 'insufficient-data';
    rollbackMessage = 'Traffic after the latest deploy is too low to make a strong rollback recommendation.';
    rollbackConfidence = 'low';
    rollbackFactors.push('Post-deploy traffic is too low to produce a strong signal.');
  }

  if (baselineAvailable && (requestsAfterAvg ?? 0) >= 20 && beforeIndexes.length >= 3 && afterIndexes.length >= 3) {
    rollbackConfidence = 'high';
    rollbackFactors.push('Baseline coverage spans both sides of the latest deploy with enough traffic.');
  } else if (rollbackConfidence !== 'low') {
    rollbackConfidence = 'medium';
    rollbackFactors.push('The recommendation is based on partial but usable telemetry coverage.');
  }

  let comparisonVerdict: ReleaseIntelligenceSummary['comparison']['verdict'] = 'steady';
  let comparisonSummary = previousDeploy
    ? 'Latest release is broadly consistent with the previous successful deploy.'
    : 'A previous successful release is required for an explicit comparison view.';
  if (!previousDeploy || !baselineAvailable) {
    comparisonVerdict = 'insufficient-data';
    comparisonSummary = previousDeploy
      ? 'Need telemetry on both sides of the latest deploy to compare it against the previous successful release.'
      : 'A previous successful release is required for an explicit comparison view.';
  } else if (rollbackRecommendation === 'rollback' || rollbackRecommendation === 'watch') {
    comparisonVerdict = 'regressed';
    comparisonSummary = 'Latest release regressed against the previous successful release and needs attention.';
  } else if ((latencyChangePct ?? 0) <= -10 || (errorChangePct ?? 0) <= -10 || (availabilityChangePctPoints ?? 0) >= 0.1) {
    comparisonVerdict = 'improved';
    comparisonSummary = 'Latest release is performing better than the previous successful release in the current telemetry window.';
  }

  const deployImpactTimeline = buildDeployImpactTimeline(successfulDeploys, metrics, timestamps);
  const anomalies: ReleaseIntelligenceSummary['anomalies'] = [];
  const recentImpactStates = deployImpactTimeline
    .map((entry) => entry.impact)
    .filter((impact): impact is 'improved' | 'steady' | 'regressed' => impact !== 'insufficient-data');

  if ((latencyAfter ?? 0) >= sloTargets.latencyP95Ms * 1.5) {
    anomalies.push({
      id: 'latency-baseline-shift',
      severity: 'critical',
      title: 'Latency baseline shifted sharply',
      detail: `Recent p95 latency is far above the ${sloTargets.latencyP95Ms} ms target for this environment.`,
    });
  } else if ((latencyChangePct ?? 0) >= 25) {
    anomalies.push({
      id: 'latency-regression-window',
      severity: 'warning',
      title: 'Latency baseline is trending upward',
      detail: 'The latest deploy window is materially slower than the previous baseline.',
    });
  }
  if ((errorAfter ?? 0) >= 2) {
    anomalies.push({
      id: 'error-rate-baseline-shift',
      severity: 'critical',
      title: '5xx baseline shifted upward',
      detail: 'The current telemetry window shows a sustained 5xx rate above the safe threshold.',
    });
  } else if (recentImpactStates.slice(0, 2).every((impact) => impact === 'regressed') && recentImpactStates.length >= 2) {
    anomalies.push({
      id: 'repeated-regression',
      severity: 'warning',
      title: 'Recent releases are regressing in sequence',
      detail: 'Two consecutive successful releases show regression signals, which suggests a moving baseline instead of a one-off spike.',
    });
  }

  return {
    latestReleaseLabel: buildReleaseLabel(latestDeploy),
    previousReleaseLabel: previousDeploy ? buildReleaseLabel(previousDeploy) : undefined,
    latestDeployAt: latestDeploy.startedAt,
    previousDeployAt: previousDeploy?.startedAt,
    deployImpactTimeline,
    comparison: {
      available: Boolean(previousDeploy) && baselineAvailable,
      verdict: comparisonVerdict,
      summary: comparisonSummary,
      latencyChangePct,
      errorRateChangePct: errorChangePct,
      availabilityChangePctPoints,
    },
    slo: {
      availabilityPct,
      errorRatePct,
      latencyP95AvgMs: latencyAvg,
      availabilityTargetPct: sloTargets.availabilityPct,
      latencyTargetMs: sloTargets.latencyP95Ms,
      availabilityState,
      latencyState,
      overallState,
    },
    baseline: {
      available: baselineAvailable,
      beforeSamples: beforeIndexes.length,
      afterSamples: afterIndexes.length,
      latencyBeforeMs: latencyBefore,
      latencyAfterMs: latencyAfter,
      latencyChangePct,
      errorRateBeforePct: errorBefore,
      errorRateAfterPct: errorAfter,
      errorRateChangePct: errorChangePct,
      requestsAfterAvg,
    },
    rollback: {
      recommendation: rollbackRecommendation,
      confidence: rollbackConfidence,
      factors: rollbackFactors,
      message: rollbackMessage,
    },
    anomalies,
  };
}
