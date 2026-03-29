/**
 * Shared status-to-CSS-class mappings for the Delivery tab and its sub-components.
 * Keeps colour logic in one place so every badge, border and background stays consistent.
 */

const STATUS_READY = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
const STATUS_REVIEW = 'border-warning/40 bg-warning/10 text-warning-foreground';
const STATUS_BLOCKED = 'border-destructive/40 bg-destructive/10 text-destructive';

export const readinessStateClasses = (state: 'ready' | 'review' | 'blocked') =>
  state === 'ready' ? STATUS_READY : state === 'review' ? STATUS_REVIEW : STATUS_BLOCKED;

export const readinessStateLabel = (state: 'ready' | 'review' | 'blocked') =>
  state === 'ready' ? 'Ready' : state === 'review' ? 'Review' : 'Blocked';

/* ── Semantic status helpers (emerald / amber / rose / neutral) ───────── */

const EMERALD = 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300';
const AMBER = 'border-amber-500/40 text-amber-700 dark:text-amber-300';
const ROSE = 'border-rose-500/40 text-rose-700 dark:text-rose-300';
const SKY = 'border-sky-500/40 text-sky-700 dark:text-sky-300';
const NEUTRAL = 'border-border/60 text-muted-foreground';

export type SloOverallState = 'meeting' | 'at-risk' | 'breached' | 'unknown';
export const sloStateClasses = (s: SloOverallState) =>
  s === 'meeting' ? EMERALD : s === 'at-risk' ? AMBER : s === 'breached' ? ROSE : NEUTRAL;

export type RollbackRecommendation = 'stable' | 'watch' | 'rollback' | 'insufficient-data';
export const rollbackClasses = (s: RollbackRecommendation) =>
  s === 'stable' ? EMERALD : s === 'watch' ? AMBER : s === 'rollback' ? ROSE : NEUTRAL;

export const rollbackConfidenceClasses = (c: 'high' | 'medium' | 'low' | string) =>
  c === 'high' ? EMERALD : c === 'medium' ? AMBER : NEUTRAL;

export type ComparisonVerdict = 'improved' | 'steady' | 'regressed' | 'insufficient-data';
export const comparisonClasses = (v: ComparisonVerdict) =>
  v === 'improved' ? EMERALD : v === 'steady' ? SKY : v === 'regressed' ? ROSE : NEUTRAL;

export const deployImpactClasses = (impact: string) =>
  impact === 'improved' ? EMERALD : impact === 'steady' ? SKY : impact === 'regressed' ? ROSE : NEUTRAL;

export type ValidationStatus = 'verified' | 'needs-review' | 'invalid' | string;
export const validationClasses = (s: ValidationStatus | undefined, loading: boolean) =>
  loading ? NEUTRAL : s === 'verified' ? EMERALD : s === 'needs-review' ? AMBER : s === 'invalid' ? ROSE : NEUTRAL;

export const validationLabel = (s: ValidationStatus | undefined, loading: boolean) =>
  loading ? 'Checking' : s === 'verified' ? 'Verified' : s === 'needs-review' ? 'Review' : s === 'invalid' ? 'Invalid' : 'Unavailable';

export const driftStateClasses = (state: string | undefined, loading: boolean) =>
  loading ? NEUTRAL : state === 'in-sync' ? EMERALD : state === 'missing' ? AMBER : state === 'out-of-sync' ? ROSE : NEUTRAL;

export const driftStateLabel = (state: string | undefined, loading: boolean) =>
  loading ? 'Checking' : state === 'in-sync' ? 'In sync' : state === 'missing' ? 'File missing' : state === 'out-of-sync' ? 'Drift' : 'Unavailable';

export const policyStatusClasses = (violations: number, dryRun: boolean, exceptions: number) =>
  violations > 0 ? (dryRun ? AMBER : ROSE) : exceptions > 0 ? AMBER : EMERALD;

export const policyStatusLabel = (violations: number, dryRun: boolean, exceptions: number, loading: boolean) =>
  loading ? 'Checking' : violations > 0 ? (dryRun ? 'Warning' : 'Blocked') : exceptions > 0 ? 'Excepted' : 'Clear';
