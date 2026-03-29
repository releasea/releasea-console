/**
 * Centralised semantic tone classes for badges, alerts and inline status indicators.
 *
 * Every tone maps to the platform's HSL design tokens defined in index.css
 * (--success, --warning, --destructive, --info, --primary, --muted).
 *
 * Usage:
 *   import { tone } from '@/lib/tone-classes';
 *   <Badge variant="outline" className={tone.success.badge}>Healthy</Badge>
 *   <div className={tone.warning.surface}>Warning block</div>
 */

/** Badge: border + subtle bg + text colour using semantic tokens */
const badgeSuccess = 'border-success/30 bg-success/10 text-success';
const badgeWarning = 'border-warning/30 bg-warning/10 text-warning';
const badgeDanger = 'border-destructive/30 bg-destructive/10 text-destructive';
const badgeInfo = 'border-info/30 bg-info/10 text-info';
const badgeNeutral = 'border-border/60 bg-muted/30 text-muted-foreground';
const badgePrimary = 'border-primary/30 bg-primary/10 text-primary';

/** Surface: bordered container for callout / alert blocks */
const surfaceSuccess = 'border border-success/20 bg-success/5';
const surfaceWarning = 'border border-warning/20 bg-warning/5';
const surfaceDanger = 'border border-destructive/20 bg-destructive/5';
const surfaceInfo = 'border border-info/20 bg-info/5';
const surfaceNeutral = 'border border-border/60 bg-muted/20';

/** Dot: small status indicator circles */
const dotSuccess = 'bg-success';
const dotWarning = 'bg-warning';
const dotDanger = 'bg-destructive';
const dotInfo = 'bg-info';
const dotNeutral = 'bg-muted-foreground/60';

export const tone = {
  success: { badge: badgeSuccess, surface: surfaceSuccess, dot: dotSuccess, text: 'text-success' },
  warning: { badge: badgeWarning, surface: surfaceWarning, dot: dotWarning, text: 'text-warning' },
  danger:  { badge: badgeDanger, surface: surfaceDanger, dot: dotDanger, text: 'text-destructive' },
  info:    { badge: badgeInfo, surface: surfaceInfo, dot: dotInfo, text: 'text-info' },
  neutral: { badge: badgeNeutral, surface: surfaceNeutral, dot: dotNeutral, text: 'text-muted-foreground' },
  primary: { badge: badgePrimary, surface: 'border border-primary/20 bg-primary/5', dot: 'bg-primary', text: 'text-primary' },
} as const;

export type ToneKey = keyof typeof tone;
