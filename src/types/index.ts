export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'no_restriction' | 'strict' | 'lax' | 'unspecified';
  session: boolean;
  expirationDate?: number;
  storeId?: string;
  hostOnly?: boolean;
  partitionKey?: unknown;
}

export interface UsageSession {
  pct: number;
  resetAt: string | null;
}

export interface Profile {
  id: string;
  name: string;
  email?: string;
  plan?: string;
  colorIndex: number;
  cookies: CookieData[];
  savedAt: number;
  lastChatUrl?: string;
  usage?: UsageSession;
}

export interface ModelUsage {
  key: string;
  label: string;
  pct: number;
}

export interface PeakHourlySlot {
  hour: number;
  label: string;
  isPeak: boolean;
  isCurrent: boolean;
  trafficPct: number;
}

export interface PeakStatus {
  active: boolean;
  trafficLevel: 'low' | 'moderate' | 'high' | 'surge';
  trafficPct: number;
  label: string;
  sublabel: string;
  prediction: string;
  countdown: string;
  nextChangeAt: string;
  localTime: string;
  schedule: string;
  tip: string;
  timeline: PeakHourlySlot[];
  currentLocalHour: number;
  codeUnaffected: boolean;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  intensity: number;
}

export interface RoutineStatus {
  used: number;
  limit: number;
}

export interface UsageDashboard {
  session: UsageSession;
  weekly: UsageSession;
  models: ModelUsage[];
  routines: RoutineStatus | null;
  plan: string;
  peak: PeakStatus;
  heatmap: HeatmapCell[];
}

export interface Settings {
  showProgressBar: boolean;
  notificationsEnabled: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export interface UsageHistoryEntry {
  at: number;
  pct: number;
}

export interface ExportedProfilesV1 {
  version: 1;
  exportedAt: string;
  profiles: Profile[];
}

export interface ExportedProfilesV2Encrypted {
  version: 2;
  encrypted: true;
  exportedAt: string;
  algorithm: 'PBKDF2-SHA256+A256GCM';
  kdf: {
    name: 'PBKDF2';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
    data: string;
  };
}

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T; error?: never }
  | { ok: false; error: string; data?: never };

export type ExtensionMessage =
  | { type: 'GET_PROFILES' }
  | { type: 'SAVE_PROFILE'; name: string; colorIndex: number }
  | { type: 'SWITCH_PROFILE'; id: string }
  | { type: 'DELETE_PROFILE'; id: string }
  | { type: 'RENAME_PROFILE'; id: string; name: string }
  | { type: 'IMPORT_PROFILES'; payload: unknown }
  | { type: 'CLEAR_COOKIES' }
  | { type: 'GET_ACTIVE_USAGE' }
  | { type: 'GET_USAGE_DASHBOARD' }
  | { type: 'REFRESH_USAGE' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'DOM_LIMIT_DETECTED'; data: UsageSession };
