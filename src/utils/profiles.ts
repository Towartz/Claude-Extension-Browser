import { CookieData, ExportedProfilesV1, Profile } from '../types';
import { clampPct } from './usage';
import { isClaudeDomain } from './cookies';

export function sanitizeName(name: string): string {
  return name.trim().slice(0, 40);
}

export function maskEmailLight(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    if (trimmed.length <= 4) return trimmed;
    const keep = Math.max(1, Math.floor(trimmed.length / 3));
    return trimmed.slice(0, keep) + '***' + trimmed.slice(-keep);
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  let maskedLocal = '';
  const len = localPart.length;

  if (len <= 3) {
    maskedLocal = len <= 2 ? localPart[0] + '*' : localPart[0] + '*' + localPart.slice(-1);
  } else if (len <= 6) {
    const prefixLen = Math.floor(len / 2);
    const suffixLen = len - prefixLen - 1;
    maskedLocal = localPart.slice(0, prefixLen) + '*' + localPart.slice(len - suffixLen);
  } else {
    const prefixLen = Math.max(3, Math.floor(len * 0.42));
    const suffixLen = Math.max(3, Math.floor(len * 0.38));
    const maskedChars = '*'.repeat(Math.min(3, Math.max(2, len - prefixLen - suffixLen)));
    maskedLocal = localPart.slice(0, prefixLen) + maskedChars + localPart.slice(len - suffixLen);
  }

  return `${maskedLocal}@${domainPart}`;
}

export function maskEmail(email: string | undefined | null): string {
  return maskEmailLight(email);
}

export function maskIfEmail(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
    return maskEmailLight(text);
  }
  return text;
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
