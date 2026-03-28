import type { Deploy, Metrics } from '@/types/releasea';
import { isSuccessfulDeployStatus, parseDeployTimestamp } from '@/lib/deploy-status';

export type ReleaseIntelligenceState = 'meeting' | 'at-risk' | 'breached' | 'unknown';
export type ReleaseRollbackRecommendation = 'stable' | 'watch' | 'rollback' | 'insufficient-data';

export interface ReleaseIntelligenceSummary {
  latestReleaseLabel: string;
  previousReleaseLabel?: string;
  latestDeployAt: string;
  previousDeployAt?: string;
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
    message: string;
  };
}

const AVAILABILITY_TARGET_PCT = 99.5;
const LATENCY_TARGET_MS = 500;

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

export function buildReleaseIntelligenceSummary(
  deploys: Deploy[],
  metrics: Metrics | null,
): ReleaseIntelligenceSummary | null {
  const successfulDeploys = deploys.filter((deploy) => isSuccessfulDeployStatus(deploy.status));
  if (!successfulDeploys.length || !metrics) {
    return null;
  }

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

  const availabilityState = resolveState(availabilityPct, AVAILABILITY_TARGET_PCT, 99.0, true);
  const latencyState = resolveState(latencyAvg, LATENCY_TARGET_MS, 750);
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
  const baselineAvailable = beforeIndexes.length >= 2 && afterIndexes.length >= 2;

  let rollbackRecommendation: ReleaseRollbackRecommendation = 'stable';
  let rollbackMessage = 'Recent telemetry looks stable after the latest deploy.';
  if (!baselineAvailable) {
    rollbackRecommendation = 'insufficient-data';
    rollbackMessage = 'Need telemetry on both sides of the latest deploy to produce a rollback recommendation.';
  } else if ((errorAfter ?? 0) >= 2 || (latencyChangePct ?? 0) >= 50) {
    rollbackRecommendation = 'rollback';
    rollbackMessage = 'Recent telemetry degraded sharply after the latest deploy. Prepare rollback or mitigation now.';
  } else if ((errorAfter ?? 0) > (errorBefore ?? 0)+0.25 || (latencyChangePct ?? 0) >= 20) {
    rollbackRecommendation = 'watch';
    rollbackMessage = 'Recent telemetry regressed after the latest deploy. Watch closely before promoting more traffic.';
  } else if ((requestsAfterAvg ?? 0) < 1) {
    rollbackRecommendation = 'insufficient-data';
    rollbackMessage = 'Traffic after the latest deploy is too low to make a strong rollback recommendation.';
  }

  return {
    latestReleaseLabel: buildReleaseLabel(latestDeploy),
    previousReleaseLabel: previousDeploy ? buildReleaseLabel(previousDeploy) : undefined,
    latestDeployAt: latestDeploy.startedAt,
    previousDeployAt: previousDeploy?.startedAt,
    slo: {
      availabilityPct,
      errorRatePct,
      latencyP95AvgMs: latencyAvg,
      availabilityTargetPct: AVAILABILITY_TARGET_PCT,
      latencyTargetMs: LATENCY_TARGET_MS,
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
      message: rollbackMessage,
    },
  };
}
