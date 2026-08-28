import { CookieData, Profile } from '../types';

export function isClaudeDomain(domain: string): boolean {
  if (typeof domain !== 'string') return false;
  const clean = domain.replace(/^\./, '').toLowerCase();
  return clean === 'claude.ai' || clean.endsWith('.claude.ai');
}

export function cookieToUrl(domain: string, path: string): string {
  const cleanDomain = domain.replace(/^\./, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `https://${cleanDomain}${cleanPath}`;
}

export function cleanCookie(cookie: chrome.cookies.Cookie): CookieData {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    session: cookie.session,
    ...(!cookie.session && cookie.expirationDate !== undefined
      ? { expirationDate: cookie.expirationDate }
      : {}),
    ...(cookie.storeId ? { storeId: cookie.storeId } : {}),
    ...(typeof cookie.hostOnly === 'boolean' ? { hostOnly: cookie.hostOnly } : {}),
    ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {})
  };
}

export function cookieToSetDetails(cookie: CookieData): chrome.cookies.SetDetails {
  return {
    url: cookieToUrl(cookie.domain, cookie.path),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
    ...(!cookie.session && cookie.expirationDate !== undefined
      ? { expirationDate: cookie.expirationDate }
      : {}),
    ...(cookie.storeId ? { storeId: cookie.storeId } : {}),
    ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey as chrome.cookies.CookiePartitionKey } : {})
  };
}

export function cookieToDetails(cookie: CookieData | chrome.cookies.Cookie): chrome.cookies.CookieDetails {
  return {
    url: cookieToUrl(cookie.domain, cookie.path),
    name: cookie.name,
    ...(cookie.storeId ? { storeId: cookie.storeId } : {}),
    ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey as chrome.cookies.CookiePartitionKey } : {})
  };
}

export function isExpired(profile: Profile, nowInSeconds: number = Date.now() / 1000): boolean {
  const nonSessionCookies = profile.cookies.filter((c) => !c.session);
  if (nonSessionCookies.length === 0) return false;
  return nonSessionCookies.every((c) => (c.expirationDate ?? Infinity) < nowInSeconds);
}
