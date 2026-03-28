export const OBSERVED_MODE_RESTRICTIONS = [
  'Deploy, canary promotion, and manual rollout actions stay blocked.',
  'Rule creation, edits, deletion, and publication remain read-only.',
  'GitOps PR actions and desired-state exports stay disabled until takeover.',
  'Source, runtime, and credential mutations that change delivery behavior are rejected.',
];
