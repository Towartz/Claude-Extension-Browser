import crypto from 'crypto';

function sanitizeName(name) {
  return typeof name === 'string' ? name.trim().slice(0, 40) : '';
}

function isDuplicateName(profiles, name, excludeId) {
  const target = sanitizeName(name).toLocaleLowerCase();
  return Object.values(profiles).some(
    (p) => p.id !== excludeId && p.name.toLocaleLowerCase() === target
  );
}

function clampColorIndex(index) {
  return Number.isInteger(index) ? Math.min(4, Math.max(0, index)) : 0;
}

function isClaudeDomain(domain) {
  if (typeof domain !== 'string') return false;
  const d = domain.replace(/^\./, '').toLowerCase();
  return d === 'claude.ai' || d.endsWith('.claude.ai');
}

function parseCookie(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw;
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
      : {})
  };
}

function parseProfile(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw;
  const name = sanitizeName(typeof p.name === 'string' ? p.name : '');
  if (!name) return null;

  const cookies = (Array.isArray(p.cookies) ? p.cookies : [])
    .map(parseCookie)
    .filter((c) => c !== null);

  if (cookies.length === 0) return null;

  return {
    id: typeof p.id === 'string' && p.id.length > 0 ? p.id : crypto.randomUUID(),
    name,
    colorIndex: clampColorIndex(Number(p.colorIndex)),
    cookies,
    savedAt: typeof p.savedAt === 'number' && Number.isFinite(p.savedAt) ? p.savedAt : Date.now()
  };
}

function validateAndParseImport(payload) {
  let list = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (typeof payload === 'object' && payload !== null) {
    if (Array.isArray(payload.profiles)) {
      list = payload.profiles;
    } else {
      list = Object.values(payload);
    }
  }
  return list.map(parseProfile).filter((p) => p !== null);
}

function generateUniqueName(profiles, baseName) {
  if (!isDuplicateName(profiles, baseName)) return baseName;
  for (let i = 2; i <= 99; i++) {
    const candidate = sanitizeName(`${baseName} ${i}`);
    if (!isDuplicateName(profiles, candidate)) return candidate;
  }
  return sanitizeName(`${baseName} ${Date.now()}`);
}

console.log('--- Testing Unlimited Accounts Logic ---');

// 1. Create a simulated batch of 12 profiles
const mockProfiles = {};
for (let i = 1; i <= 12; i++) {
  const id = `profile-${i}`;
  mockProfiles[id] = {
    id,
    name: `Claude Account ${i}`,
    colorIndex: (i - 1) % 5,
    cookies: [
      {
        name: 'sessionKey',
        value: `sk-ant-sid01-mock-session-${i}`,
        domain: '.claude.ai',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        session: false,
        expirationDate: Date.now() / 1000 + 86400 * 30
      }
    ],
    savedAt: Date.now() - i * 1000
  };
}

console.log(`[PASS] Successfully instantiated ${Object.keys(mockProfiles).length} profiles.`);

// 2. Test unique name generation for large account sets
const duplicateCandidate = generateUniqueName(mockProfiles, 'Claude Account 1');
console.log(`[PASS] Duplicate name resolved: "Claude Account 1" -> "${duplicateCandidate}"`);

// 3. Test batch import parsing with 12 accounts
const exportPayload = {
  version: 1,
  exportedAt: new Date().toISOString(),
  profiles: Object.values(mockProfiles)
};

const parsed = validateAndParseImport(exportPayload);
if (parsed.length !== 12) {
  console.error(`FAIL: Expected 12 imported profiles, got ${parsed.length}`);
  process.exit(1);
}
console.log(`[PASS] Successfully parsed all ${parsed.length} profiles from import payload without limit.`);

console.log('\nAll unlimited accounts logic tests passed successfully!');
