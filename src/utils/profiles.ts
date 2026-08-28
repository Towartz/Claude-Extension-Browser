import { CookieData, ExportedProfilesV1, Profile } from '../types';
import { clampPct } from './usage';
import { isClaudeDomain } from './cookies';

export function sanitizeName(name: string): string {
  return name.trim().slice(0, 40);
}

export function isDuplicateName(
  profiles: Record<string, Profile>,
  name: string,
  excludeId?: string
): boolean {
  const target = sanitizeName(name).toLocaleLowerCase();
  return Object.values(profiles).some(
    (p) => p.id !== excludeId && p.name.toLocaleLowerCase() === target
  );
}

export function clampColorIndex(index: number): number {
  return Number.isInteger(index) ? Math.min(4, Math.max(0, index)) : 0;
}

export function isValidChatUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === 'https://claude.ai' && /^\/chat\/[^/?#]+/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function sanitizeChatUrl(url: string): string {
  const parsed = new URL(url);
  return `https://claude.ai${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function exportProfiles(
  profiles: Record<string, Profile>,
  exportedAt: string = new Date().toISOString()
): ExportedProfilesV1 {
  return {
    version: 1,
    exportedAt,
    profiles: Object.values(profiles).sort((a, b) => b.savedAt - a.savedAt)
  };
}

function parseCookie(raw: unknown): CookieData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Partial<CookieData>;
  if (
    typeof c.domain !== 'string' ||
    !isClaudeDomain(c.domain) ||
    typeof c.name !== 'string' ||
    c.name.length === 0 ||
    typeof c.value !== 'string' ||
    typeof c.path !== 'string' ||
    !c.path.startsWith('/')
  ) {
    return null;
  }

  const isSession = typeof c.session === 'boolean' ? c.session : c.expirationDate === undefined;
  const sameSite =
    c.sameSite === 'no_restriction' ||
    c.sameSite === 'strict' ||
    c.sameSite === 'lax' ||
    c.sameSite === 'unspecified'
      ? c.sameSite
      : 'lax';

  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure === true,
    httpOnly: c.httpOnly === true,
    sameSite,
    session: isSession,
    ...(!isSession && typeof c.expirationDate === 'number' && Number.isFinite(c.expirationDate)
      ? { expirationDate: c.expirationDate }
      : {}),
    ...(typeof c.storeId === 'string' ? { storeId: c.storeId } : {}),
    ...(typeof c.hostOnly === 'boolean' ? { hostOnly: c.hostOnly } : {}),
    ...(typeof c.partitionKey === 'object' && c.partitionKey !== null
      ? { partitionKey: c.partitionKey }
      : {})
  };
}

function parseProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Partial<Profile>;
  const name = sanitizeName(typeof p.name === 'string' ? p.name : '');
  if (!name) return null;

  const cookies = (Array.isArray(p.cookies) ? p.cookies : [])
    .map(parseCookie)
    .filter((c): c is CookieData => c !== null);

  if (cookies.length === 0) return null;

  const usageSession =
    typeof p.usage === 'object' && p.usage !== null && Number.isFinite(Number(p.usage.pct))
      ? {
          pct: clampPct(p.usage.pct),
          resetAt: typeof p.usage.resetAt === 'string' ? p.usage.resetAt : null
        }
      : undefined;

  return {
    id: typeof p.id === 'string' && p.id.length > 0 ? p.id : crypto.randomUUID(),
    name,
    colorIndex: clampColorIndex(Number(p.colorIndex)),
    cookies,
    savedAt: typeof p.savedAt === 'number' && Number.isFinite(p.savedAt) ? p.savedAt : Date.now(),
    ...(typeof p.email === 'string' && p.email.length > 0 ? { email: p.email.slice(0, 254) } : {}),
    ...(typeof p.lastChatUrl === 'string' && isValidChatUrl(p.lastChatUrl)
      ? { lastChatUrl: sanitizeChatUrl(p.lastChatUrl) }
      : {}),
    ...(usageSession ? { usage: usageSession } : {})
  };
}

export function validateAndParseImport(payload: unknown): Profile[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (typeof payload === 'object' && payload !== null) {
    const obj = payload as { profiles?: unknown };
    if (Array.isArray(obj.profiles)) {
      list = obj.profiles;
    } else {
      list = Object.values(payload);
    }
  }

  return list.map(parseProfile).filter((p): p is Profile => p !== null);
}

export function generateUniqueName(profiles: Record<string, Profile>, baseName: string): string {
  if (!isDuplicateName(profiles, baseName)) return baseName;
  for (let i = 2; i <= 99; i++) {
    const candidate = sanitizeName(`${baseName} ${i}`);
    if (!isDuplicateName(profiles, candidate)) return candidate;
  }
  return sanitizeName(`${baseName} ${Date.now()}`);
}
