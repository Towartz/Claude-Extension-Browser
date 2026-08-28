import {
  CookieData,
  ExtensionMessage,
  ExtensionResponse,
  ModelUsage,
  Profile,
  RoutineStatus,
  Settings,
  UsageDashboard,
  UsageHistoryEntry,
  UsageSession
} from '../types';
import {
  clampColorIndex,
  clampPct,
  cleanCookie,
  cookieToDetails,
  cookieToSetDetails,
  decryptProfilesFromStorage,
  encryptProfilesForStorage,
  formatDashboard,
  generateModels,
  generateUniqueName,
  isDuplicateName,
  isValidChatUrl,
  parseResetTimestamp,
  sanitizeChatUrl,
  sanitizeName,
  validateAndParseImport
} from '../utils';

const STORAGE_PROFILES = 'claude_profiles';
const STORAGE_ACTIVE_ID = 'claude_active_profile_id';
const STORAGE_SETTINGS = 'claude_settings';
const STORAGE_USAGE_HISTORY = 'claude_usage_history';
const STORAGE_LATEST_DASHBOARD = 'claude_latest_dashboard';

const CLAUDE_DOMAIN = 'claude.ai';
const CLAUDE_HOME = 'https://claude.ai/';
const CLAUDE_MATCH_PATTERN = 'https://claude.ai/*';

const DEFAULT_SETTINGS: Settings = {
  showProgressBar: true,
  notificationsEnabled: false,
  theme: 'auto'
};

async function getStoredProfiles(): Promise<Record<string, Profile>> {
  const result = await chrome.storage.local.get(STORAGE_PROFILES);
  const raw = result[STORAGE_PROFILES] as Record<string, any> | undefined;
  if (!raw || typeof raw !== 'object') return {};

  const { profiles, migrated } = await decryptProfilesFromStorage(raw);
  if (migrated) {
    // If legacy unencrypted cookies were found on disk, immediately re-save with encryption
    setStoredProfiles(profiles).catch(() => {});
  }
  return profiles;
}

async function setStoredProfiles(profiles: Record<string, Profile>): Promise<void> {
  const encrypted = await encryptProfilesForStorage(profiles);
  await chrome.storage.local.set({ [STORAGE_PROFILES]: encrypted });
}

async function getStoredDashboard(): Promise<UsageDashboard | undefined> {
  const result = await chrome.storage.local.get(STORAGE_LATEST_DASHBOARD);
  return result[STORAGE_LATEST_DASHBOARD] as UsageDashboard | undefined;
}

async function setStoredDashboard(dashboard: UsageDashboard): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_LATEST_DASHBOARD]: dashboard });
}

async function getActiveProfileId(): Promise<string | undefined> {
  const result = await chrome.storage.local.get(STORAGE_ACTIVE_ID);
  const id = result[STORAGE_ACTIVE_ID];
  return typeof id === 'string' ? id : undefined;
}

async function setActiveProfileId(id: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_ACTIVE_ID]: id });
}

async function clearActiveProfileId(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_ACTIVE_ID);
}

async function getStoredSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_SETTINGS);
  const s = result[STORAGE_SETTINGS] as Partial<Settings> | undefined;
  if (!s || typeof s !== 'object') return DEFAULT_SETTINGS;
  return {
    showProgressBar: typeof s.showProgressBar === 'boolean' ? s.showProgressBar : DEFAULT_SETTINGS.showProgressBar,
    notificationsEnabled: typeof s.notificationsEnabled === 'boolean' ? s.notificationsEnabled : DEFAULT_SETTINGS.notificationsEnabled,
    theme: s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto' ? s.theme : DEFAULT_SETTINGS.theme
  };
}

async function setStoredSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getStoredSettings();
  const updated: Settings = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_SETTINGS]: updated });
  return updated;
}

async function getUsageHistory(): Promise<UsageHistoryEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_USAGE_HISTORY);
  const hist = result[STORAGE_USAGE_HISTORY];
  if (!Array.isArray(hist)) return [];
  return hist
    .filter((e): e is UsageHistoryEntry => typeof e === 'object' && e !== null && typeof e.at === 'number' && typeof e.pct === 'number')
    .slice(-720);
}

async function recordUsageHistory(pct: number, now: number = Date.now()): Promise<UsageHistoryEntry[]> {
  const entry: UsageHistoryEntry = { at: now, pct: clampPct(pct) };
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const history = [...(await getUsageHistory()), entry]
    .filter((e) => e.at >= thirtyDaysAgo)
    .slice(-720);
  await chrome.storage.local.set({ [STORAGE_USAGE_HISTORY]: history });
  return history;
}

async function getAllClaudeCookies(): Promise<chrome.cookies.Cookie[]> {
  return chrome.cookies.getAll({ domain: CLAUDE_DOMAIN });
}

async function removeAllClaudeCookies(): Promise<void> {
  const cookies = await getAllClaudeCookies();
  await Promise.all(
    cookies.map(async (cookie) => {
      try {
        await chrome.cookies.remove(cookieToDetails(cookie));
      } catch {}
    })
  );
}

async function restoreCookies(cookies: CookieData[]): Promise<{ attempted: number; restored: number; skipped: number }> {
  let restored = 0;
  let skipped = 0;
  for (const cookie of cookies) {
    try {
      const res = await chrome.cookies.set(cookieToSetDetails(cookie));
      if (res) restored++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { attempted: cookies.length, restored, skipped };
}

function findSessionToken(cookies: (chrome.cookies.Cookie | CookieData)[]): string | undefined {
  return cookies.find((c) => c.name.toLowerCase().includes('session'))?.value;
}

async function getActiveChatUrl(): Promise<string | undefined> {
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true, url: CLAUDE_MATCH_PATTERN });
  const activeUrl = activeTabs.map((t) => t.url).find(isValidChatUrl);
  if (activeUrl) return sanitizeChatUrl(activeUrl);

  const allClaudeTabs = await chrome.tabs.query({ url: CLAUDE_MATCH_PATTERN });
  const anyUrl = allClaudeTabs.map((t) => t.url).find(isValidChatUrl);
  return anyUrl ? sanitizeChatUrl(anyUrl) : undefined;
}

async function navigateClaudeTabs(targetUrl: string = CLAUDE_HOME): Promise<void> {
  const tabs = await chrome.tabs.query({ url: CLAUDE_MATCH_PATTERN });
  if (tabs.length === 0) {
    await chrome.tabs.create({ url: targetUrl });
    return;
  }
  await Promise.all(
    tabs
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number')
      .map((id) => chrome.tabs.update(id, { url: targetUrl }))
  );
}

function parsePlanTier(org: Record<string, unknown>): string {
  const combined = [
    org.plan,
    org.subscription_tier,
    org.rate_limit_tier,
    org.rate_limit_upsell,
    org.billing_type,
    org.name
  ]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();

  if (combined.includes('enterprise')) return 'Enterprise';
  if (combined.includes('team')) return 'Team';
  if (combined.includes('20')) return 'Max 20x';
  if (combined.includes('max')) return 'Max 5x';
  if (combined.includes('pro')) return 'Pro';
  if (combined.includes('default_claude_ai') || combined.includes('upgrade_to_pro') || combined.includes('free')) return 'Free';
  return 'Free';
}

function extractUtilization(raw: Record<string, unknown> | null | undefined, keys: string[]): UsageSession | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const topPct = raw.utilization ?? raw.utilization_pct ?? raw.percentage ?? raw.percent ?? raw.pct;
  if (topPct !== undefined && topPct !== null && !Number.isNaN(Number(topPct))) {
    const rawReset = raw.resets_at ?? raw.reset_at ?? raw.renew_at;
    const resetAt = parseResetTimestamp(rawReset);
    return { pct: clampPct(topPct), resetAt };
  }

  for (const key of keys) {
    const val = raw[key];
    if (typeof val === 'number') {
      return { pct: clampPct(val), resetAt: null };
    }
    if (typeof val !== 'object' || val === null) continue;
    const obj = val as Record<string, unknown>;

    const pctVal = obj.utilization ?? obj.utilization_pct ?? obj.percentage ?? obj.percent ?? obj.pct;
    const rawReset = obj.resets_at ?? obj.reset_at ?? obj.renew_at ?? raw.resets_at ?? raw.reset_at ?? raw.renew_at;
    const resetAt = parseResetTimestamp(rawReset);

    if (pctVal !== undefined && pctVal !== null && !Number.isNaN(Number(pctVal))) {
      return { pct: clampPct(pctVal), resetAt };
    }

    const used = Number(obj.used ?? obj.count ?? obj.current);
    const limit = Number(obj.limit ?? obj.max ?? obj.total);
    const remaining = Number(obj.remaining ?? obj.left);

    if (Number.isFinite(limit) && limit > 0) {
      if (Number.isFinite(used)) {
        return { pct: clampPct((used / limit) * 100), resetAt };
      }
      if (Number.isFinite(remaining)) {
        return { pct: clampPct(((limit - Math.max(0, remaining)) / limit) * 100), resetAt };
      }
    }
  }
  return undefined;
}

function extractModelsUsage(raw: Record<string, unknown>, weeklyPct: number): ModelUsage[] {
  const modelsObj = [raw.models, raw.model_usage, (raw.weekly as Record<string, unknown>)?.models].find(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null
  );

  if (!modelsObj) return [];

  return generateModels(weeklyPct).map((model) => {
    const matched = modelsObj[model.key] ?? modelsObj[model.label] ?? modelsObj[model.label.toLowerCase()];
    if (typeof matched === 'object' && matched !== null) {
      const mObj = matched as Record<string, unknown>;
      const pct = mObj.utilization ?? mObj.utilization_pct ?? mObj.percentage ?? mObj.percent ?? mObj.pct;
      return { ...model, pct: clampPct(pct) };
    }
    return { ...model, pct: clampPct(matched ?? model.pct) };
  });
}

function extractRoutines(raw: Record<string, unknown>): RoutineStatus | null {
  const r = raw.routines ?? raw.daily_routines ?? raw.claude_code_routines;
  if (typeof r !== 'object' || r === null) return null;
  const obj = r as Record<string, unknown>;
  const used = Number(obj.used ?? obj.count ?? obj.current);
  const limit = Number(obj.limit ?? obj.max ?? obj.total);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  return { used: Math.max(0, used), limit: Math.max(0, limit) };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 25 * 1000;
let fullUsageCache: CacheEntry<{
  usage: UsageSession;
  weekly: UsageSession;
  models: ModelUsage[];
  routines: RoutineStatus | null;
  plan: string;
}> | null = null;
let userEmailCache: CacheEntry<string> | null = null;

function invalidateCache(): void {
  fullUsageCache = null;
  userEmailCache = null;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 2500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUserEmail(): Promise<string | undefined> {
  if (userEmailCache && Date.now() - userEmailCache.timestamp < CACHE_TTL_MS) {
    return userEmailCache.data;
  }

  const endpoints = [
    { url: 'https://claude.ai/api/auth/current_user', getter: (d: any) => d?.email_address || d?.email || d?.user?.email_address },
    { url: 'https://claude.ai/api/users/current', getter: (d: any) => d?.email_address || d?.email },
    { url: 'https://claude.ai/api/account', getter: (d: any) => d?.email_address || d?.email }
  ];

  for (const { url, getter } of endpoints) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      }, 2000);
      if (res.ok) {
        const json = await res.json();
        const email = getter(json);
        if (typeof email === 'string' && email.length > 0) {
          userEmailCache = { data: email, timestamp: Date.now() };
          return email;
        }
      }
    } catch {}
  }
  return undefined;
}

async function fetchFullUsage(): Promise<{
  usage: UsageSession;
  weekly: UsageSession;
  models: ModelUsage[];
  routines: RoutineStatus | null;
  plan: string;
} | undefined> {
  if (fullUsageCache && Date.now() - fullUsageCache.timestamp < CACHE_TTL_MS) {
    return fullUsageCache.data;
  }

  try {
    const orgsRes = await fetchWithTimeout('https://claude.ai/api/organizations', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    }, 2500);
    if (!orgsRes.ok) return undefined;

    const orgs = await orgsRes.json();
    const chatOrg =
      (Array.isArray(orgs) &&
        orgs.find((o: any) => Array.isArray(o.capabilities) && o.capabilities.includes('chat'))) ||
      orgs[0];
    if (!chatOrg) return undefined;

    const plan = parsePlanTier(chatOrg);
    const orgUuid = chatOrg.uuid;
    let rawUsage: Record<string, unknown> = {};
    let headerSession: UsageSession | null = null;
    let headerWeekly: UsageSession | null = null;

    if (orgUuid && typeof orgUuid === 'string') {
      // 1. Fetch chat_conversations to inspect authoritative gateway rate-limit headers
      try {
        const convRes = await fetchWithTimeout(
          `https://claude.ai/api/organizations/${orgUuid}/chat_conversations?limit=1`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' }
          },
          2500
        );
        if (convRes.ok) {
          const u5h =
            convRes.headers.get('anthropic-ratelimit-unified-5hour-utilization') ||
            convRes.headers.get('anthropic-ratelimit-5hour-utilization') ||
            convRes.headers.get('anthropic-ratelimit-unified-session-utilization');
          const r5h =
            convRes.headers.get('anthropic-ratelimit-unified-5hour-reset') ||
            convRes.headers.get('anthropic-ratelimit-5hour-reset') ||
            convRes.headers.get('anthropic-ratelimit-unified-session-reset');
          const u7d =
            convRes.headers.get('anthropic-ratelimit-unified-7day-utilization') ||
            convRes.headers.get('anthropic-ratelimit-unified-weekly-utilization') ||
            convRes.headers.get('anthropic-ratelimit-7day-utilization');
          const r7d =
            convRes.headers.get('anthropic-ratelimit-unified-7day-reset') ||
            convRes.headers.get('anthropic-ratelimit-unified-weekly-reset') ||
            convRes.headers.get('anthropic-ratelimit-7day-reset');

          if (u5h != null && !Number.isNaN(Number(u5h))) {
            headerSession = { pct: clampPct(u5h), resetAt: parseResetTimestamp(r5h) };
          }
          if (u7d != null && !Number.isNaN(Number(u7d))) {
            headerWeekly = { pct: clampPct(u7d), resetAt: parseResetTimestamp(r7d) };
          }
        }
      } catch {}

      // 2. Fetch usage breakdown endpoint
      try {
        const usageRes = await fetchWithTimeout(
          `https://claude.ai/api/organizations/${orgUuid}/usage`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' }
          },
          2000
        );
        if (usageRes.ok) {
          rawUsage = (await usageRes.json()) ?? {};
        }
      } catch {}
    }

    const sessionKeys = [
      'five_hour',
      'session',
      'fiveHour',
      '5_hour',
      '5hour',
      'message_limit',
      'messageLimit',
      'messages',
      'queries',
      'free_tier',
      'freeTier',
      'rate_limit',
      'daily',
      'limit'
    ];
    const weeklyKeys = ['weekly', 'seven_day', 'seven_days', 'week', 'weekly_limit'];

    const jsonSession = extractUtilization(rawUsage, sessionKeys);
    const jsonWeekly = extractUtilization(rawUsage, weeklyKeys);

    const session = headerSession ?? jsonSession ?? {
      pct: 0,
      resetAt: null
    };

    const weekly = headerWeekly ?? jsonWeekly ?? {
      pct: 0,
      resetAt: null
    };

    const models = plan === 'Free' ? [] : extractModelsUsage(rawUsage, weekly.pct);
    const routines = extractRoutines(rawUsage);

    const result = { usage: session, weekly, models, routines, plan };
    fullUsageCache = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return undefined;
  }
}

async function getActiveUsage(): Promise<UsageSession | undefined> {
  return fullUsageCache?.data?.usage;
}

async function getUsageDashboard(fetchNetwork: boolean = false): Promise<UsageDashboard> {
  if (fetchNetwork) {
    const [full, email] = await Promise.all([fetchFullUsage(), fetchUserEmail()]);
    const session = full?.usage ?? { pct: 0, resetAt: null };
    const history = await recordUsageHistory(session.pct);

    if (email) {
      getActiveProfileId()
        .then(async (activeId) => {
          if (activeId) {
            const profiles = await getStoredProfiles();
            if (profiles[activeId] && profiles[activeId].email !== email) {
              profiles[activeId].email = email;
              if (full?.plan) profiles[activeId].plan = full.plan;
              await setStoredProfiles(profiles);
            }
          }
        })
        .catch(() => {});
    }

    const formatted = formatDashboard({
      session,
      weekly: full?.weekly,
      models: full?.models,
      routines: full?.routines,
      plan: full?.plan,
      history
    });

    await setStoredDashboard(formatted);
    return formatted;
  }

  // Never fetch over network unless explicitly requested by user refresh action
  if (fullUsageCache?.data) {
    const history = await getUsageHistory();
    return formatDashboard({
      session: fullUsageCache.data.usage,
      weekly: fullUsageCache.data.weekly,
      models: fullUsageCache.data.models,
      routines: fullUsageCache.data.routines,
      plan: fullUsageCache.data.plan,
      history
    });
  }

  const stored = await getStoredDashboard();
  if (stored) {
    return stored;
  }

  const history = await getUsageHistory();
  return formatDashboard({
    session: { pct: 0, resetAt: null },
    history
  });
}

async function syncActiveProfileCookies(): Promise<Record<string, Profile>> {
  const profiles = await getStoredProfiles();
  const cookies = await getAllClaudeCookies();
  if (cookies.length === 0) return profiles;

  const activeId = await detectActiveProfileId(profiles, cookies);
  if (!activeId || !profiles[activeId]) return profiles;

  const currentChatUrl = await getActiveChatUrl();
  const updated: Profile = {
    ...profiles[activeId],
    cookies: cookies.map(cleanCookie),
    savedAt: Date.now(),
    ...(currentChatUrl ? { lastChatUrl: currentChatUrl } : {})
  };

  const newProfiles = { ...profiles, [activeId]: updated };
  await setStoredProfiles(newProfiles);
  await setActiveProfileId(activeId);
  return newProfiles;
}

async function detectActiveProfileId(
  profiles: Record<string, Profile>,
  cookies?: chrome.cookies.Cookie[]
): Promise<string | undefined> {
  const explicitId = await getActiveProfileId();
  if (explicitId && profiles[explicitId]) return explicitId;

  const currentCookies = cookies ?? (await getAllClaudeCookies());
  const token = findSessionToken(currentCookies);
  if (token) {
    return Object.values(profiles).find((p) =>
      p.cookies.some((c) => c.name.toLowerCase().includes('session') && c.value === token)
    )?.id;
  }
  return undefined;
}

async function handleSaveProfile(name: string, colorIndex: number): Promise<ExtensionResponse<Profile>> {
  const sanitized = sanitizeName(name);
  if (!sanitized) {
    return { ok: false, error: 'Please enter a name for this profile.' };
  }

  const profiles = await getStoredProfiles();

  if (isDuplicateName(profiles, sanitized)) {
    return { ok: false, error: 'A profile with that name already exists.' };
  }

  const cookies = await getAllClaudeCookies();
  if (cookies.length === 0) {
    return { ok: false, error: "No active session — make sure you're logged in to Claude." };
  }

  const lastChatUrl = await getActiveChatUrl();
  const cached = fullUsageCache?.data;

  const newProfile: Profile = {
    id: crypto.randomUUID(),
    name: sanitized,
    colorIndex: clampColorIndex(colorIndex),
    cookies: cookies.map(cleanCookie),
    savedAt: Date.now(),
    ...(userEmailCache?.data ? { email: userEmailCache.data } : {}),
    ...(cached?.plan ? { plan: cached.plan } : {}),
    ...(lastChatUrl ? { lastChatUrl } : {})
  };

  if (cached?.usage) {
    newProfile.usage = cached.usage;
  }

  await setStoredProfiles({ ...profiles, [newProfile.id]: newProfile });
  await setActiveProfileId(newProfile.id);

  return { ok: true, data: newProfile };
}

async function handleSwitchProfile(id: string): Promise<ExtensionResponse<{ attempted: number; restored: number; skipped: number }>> {
  invalidateCache();
  const profiles = await syncActiveProfileCookies();
  const target = profiles[id];
  if (!target) {
    return { ok: false, error: 'Profile not found.' };
  }

  const currentId = await getActiveProfileId();
  if (currentId === id) {
    await navigateClaudeTabs(target.lastChatUrl ?? CLAUDE_HOME);
    return { ok: true, data: { attempted: target.cookies.length, restored: 0, skipped: 0 } };
  }

  await removeAllClaudeCookies();
  const stats = await restoreCookies(target.cookies);
  await setActiveProfileId(id);
  await navigateClaudeTabs(target.lastChatUrl ?? CLAUDE_HOME);

  return { ok: true, data: stats };
}

async function handleDeleteProfile(id: string): Promise<ExtensionResponse<void>> {
  const profiles = await getStoredProfiles();
  if (!profiles[id]) {
    return { ok: false, error: 'Profile not found.' };
  }

  const nextProfiles = Object.fromEntries(Object.entries(profiles).filter(([key]) => key !== id));
  await setStoredProfiles(nextProfiles);

  const activeId = await getActiveProfileId();
  if (activeId === id) {
    await clearActiveProfileId();
  }
  invalidateCache();

  return { ok: true, data: undefined };
}

async function handleRenameProfile(id: string, newName: string): Promise<ExtensionResponse<Profile>> {
  const sanitized = sanitizeName(newName);
  if (!sanitized) {
    return { ok: false, error: 'Please enter a name for this profile.' };
  }

  const profiles = await getStoredProfiles();
  const existing = profiles[id];
  if (!existing) {
    return { ok: false, error: 'Profile not found.' };
  }

  if (isDuplicateName(profiles, sanitized, id)) {
    return { ok: false, error: 'A profile with that name already exists.' };
  }

  const updated = { ...existing, name: sanitized };
  await setStoredProfiles({ ...profiles, [id]: updated });

  return { ok: true, data: updated };
}

async function handleImportProfiles(payload: unknown): Promise<ExtensionResponse<{ profiles: Record<string, Profile>; imported: number }>> {
  const profiles = await getStoredProfiles();

  const importedList = validateAndParseImport(payload);
  if (importedList.length === 0) {
    return { ok: false, error: 'No valid profiles found in that file.' };
  }

  const nextProfiles = { ...profiles };
  for (const item of importedList) {
    const id = nextProfiles[item.id] ? crypto.randomUUID() : item.id;
    const name = generateUniqueName(nextProfiles, item.name);
    nextProfiles[id] = { ...item, id, name };
  }

  await setStoredProfiles(nextProfiles);
  invalidateCache();
  return { ok: true, data: { profiles: nextProfiles, imported: importedList.length } };
}

async function handleClearCookies(): Promise<ExtensionResponse<void>> {
  invalidateCache();
  const profiles = await getStoredProfiles();
  const activeId = await detectActiveProfileId(profiles);
  if (activeId && profiles[activeId]) {
    const lastChatUrl = await getActiveChatUrl();
    if (lastChatUrl) {
      await setStoredProfiles({
        ...profiles,
        [activeId]: { ...profiles[activeId], lastChatUrl }
      });
    }
  }

  await removeAllClaudeCookies();
  await clearActiveProfileId();
  await navigateClaudeTabs(CLAUDE_HOME);

  return { ok: true, data: undefined };
}

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse<any>> {
  try {
    switch (message.type) {
      case 'GET_PROFILES': {
        const profiles = await getStoredProfiles();
        const activeProfileId = await detectActiveProfileId(profiles);
        // Non-blocking background sync so popup loads instantly without network lag
        syncActiveProfileCookies().catch(() => {});
        return { ok: true, data: { profiles, activeProfileId } };
      }
      case 'SAVE_PROFILE':
        return await handleSaveProfile(message.name, message.colorIndex);
      case 'SWITCH_PROFILE':
        return await handleSwitchProfile(message.id);
      case 'DELETE_PROFILE':
        return await handleDeleteProfile(message.id);
      case 'RENAME_PROFILE':
        return await handleRenameProfile(message.id, message.name);
      case 'IMPORT_PROFILES':
        return await handleImportProfiles(message.payload);
      case 'CLEAR_COOKIES':
        return await handleClearCookies();
      case 'GET_ACTIVE_USAGE':
        return { ok: true, data: await getActiveUsage() };
      case 'GET_USAGE_DASHBOARD':
        return { ok: true, data: await getUsageDashboard(false) };
      case 'REFRESH_USAGE':
        invalidateCache();
        return { ok: true, data: await getUsageDashboard(true) };
      case 'DOM_LIMIT_DETECTED': {
        if (fullUsageCache?.data) {
          fullUsageCache.data.usage = message.data;
          fullUsageCache.timestamp = Date.now();
        }
        getActiveProfileId().then(async (activeId) => {
          if (activeId) {
            const profiles = await getStoredProfiles();
            if (profiles[activeId]) {
              profiles[activeId].usage = message.data;
              await setStoredProfiles(profiles);
            }
          }
        }).catch(() => {});
        return { ok: true, data: undefined };
      }
      case 'GET_SETTINGS':
        return { ok: true, data: await getStoredSettings() };
      case 'SET_SETTINGS':
        return { ok: true, data: await setStoredSettings(message.settings) };
      default:
        return { ok: false, error: 'Unknown message type.' };
    }
  } catch {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

// Setup live header interception for real-time anthropic-ratelimit headers and 429 status
function setupHeaderInterceptor(): void {
  if (typeof chrome.webRequest?.onHeadersReceived?.addListener !== 'function') return;

  try {
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (!details.responseHeaders || details.responseHeaders.length === 0) return;

        let sessionUtil: number | null = null;
        let sessionReset: string | null = null;
        let weeklyUtil: number | null = null;
        let weeklyReset: string | null = null;

        if (details.statusCode === 429) {
          sessionUtil = 100;
          for (const header of details.responseHeaders) {
            const name = header.name.toLowerCase();
            const val = header.value;
            if (name === 'retry-after' && val) {
              const seconds = Number(val);
              if (Number.isFinite(seconds) && seconds > 0) {
                sessionReset = new Date(Date.now() + seconds * 1000).toISOString();
              }
            }
          }
        }

        for (const header of details.responseHeaders) {
          const name = header.name.toLowerCase();
          const val = header.value;
          if (!val) continue;

          if (
            name === 'anthropic-ratelimit-unified-5hour-utilization' ||
            name === 'anthropic-ratelimit-5hour-utilization' ||
            name === 'anthropic-ratelimit-unified-session-utilization'
          ) {
            sessionUtil = clampPct(val);
          } else if (
            name === 'anthropic-ratelimit-unified-5hour-reset' ||
            name === 'anthropic-ratelimit-5hour-reset' ||
            name === 'anthropic-ratelimit-unified-session-reset'
          ) {
            sessionReset = parseResetTimestamp(val);
          } else if (
            name === 'anthropic-ratelimit-unified-7day-utilization' ||
            name === 'anthropic-ratelimit-unified-weekly-utilization' ||
            name === 'anthropic-ratelimit-7day-utilization'
          ) {
            weeklyUtil = clampPct(val);
          } else if (
            name === 'anthropic-ratelimit-unified-7day-reset' ||
            name === 'anthropic-ratelimit-unified-weekly-reset' ||
            name === 'anthropic-ratelimit-7day-reset'
          ) {
            weeklyReset = parseResetTimestamp(val);
          }
        }

        if (sessionUtil !== null) {
          const updatedUsage: UsageSession = {
            pct: sessionUtil,
            resetAt: sessionReset ?? null
          };

          if (fullUsageCache?.data) {
            fullUsageCache.data.usage = updatedUsage;
            if (weeklyUtil !== null) {
              fullUsageCache.data.weekly = { pct: weeklyUtil, resetAt: weeklyReset ?? null };
            }
            fullUsageCache.timestamp = Date.now();
          }

          chrome.tabs.query({ url: CLAUDE_MATCH_PATTERN }, (tabs) => {
            for (const tab of tabs) {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'USAGE_UPDATED', data: updatedUsage }).catch(() => {});
              }
            }
          });

          getActiveProfileId()
            .then(async (activeId) => {
              if (activeId) {
                const profiles = await getStoredProfiles();
                if (profiles[activeId]) {
                  profiles[activeId].usage = updatedUsage;
                  await setStoredProfiles(profiles);
                }
              }
            })
            .catch(() => {});
        }
      },
      { urls: ['https://claude.ai/api/*'] },
      ['responseHeaders']
    );
  } catch {}
}

setupHeaderInterceptor();

// Ensure chrome storage access levels
if (typeof chrome.storage?.local?.setAccessLevel === 'function') {
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
}

// Register background message dispatcher
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});
