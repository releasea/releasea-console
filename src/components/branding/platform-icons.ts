import {
  Fingerprint,
  FolderKanban,
  Gauge,
  Layers,
  LayoutDashboard,
  ServerCog,
  Settings,
  ShieldCheck,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

export const platformIcons = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  services: Waypoints,
  workers: ServerCog,
  environments: Layers,
  runtimeProfiles: Gauge,
  teams: Users,
  identity: Fingerprint,
  governance: ShieldCheck,
  settings: Settings,
} as const satisfies Record<string, LucideIcon>;

export type PlatformIconName = keyof typeof platformIcons;
