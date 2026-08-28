import { ExportedProfilesV1, ExportedProfilesV2Encrypted } from '../types';

const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ALGORITHM_NAME = 'PBKDF2-SHA256+A256GCM';

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buffer).set(arr);
  return buffer;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedPayload(payload: unknown): payload is ExportedProfilesV2Encrypted {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Partial<ExportedProfilesV2Encrypted>;
  return (
    p.version === 2 &&
    p.encrypted === true &&
    p.algorithm === ALGORITHM_NAME &&
    typeof p.kdf === 'object' &&
    p.kdf !== null &&
    p.kdf.name === 'PBKDF2' &&
    typeof p.kdf.iterations === 'number' &&
    typeof p.kdf.salt === 'string' &&
    typeof p.cipher === 'object' &&
    p.cipher !== null &&
    p.cipher.name === 'AES-GCM' &&
    typeof p.cipher.iv === 'string' &&
    typeof p.cipher.data === 'string'
  );
}

export async function encryptProfiles(
  data: ExportedProfilesV1,
  passphrase: string
): Promise<ExportedProfilesV2Encrypted> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);

  const encodedData = new TextEncoder().encode(JSON.stringify(data));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encodedData)
  );

  return {
    version: 2,
    encrypted: true,
    exportedAt: data.exportedAt,
    algorithm: ALGORITHM_NAME,
    kdf: {
      name: 'PBKDF2',
      iterations: PBKDF2_ITERATIONS,
      salt: bufferToBase64(salt)
    },
    cipher: {
      name: 'AES-GCM',
      iv: bufferToBase64(iv),
      data: bufferToBase64(new Uint8Array(encryptedBuffer))
    }
  };
}

export async function decryptProfiles(
  encryptedPayload: unknown,
  passphrase: string
): Promise<ExportedProfilesV1> {
  if (!isEncryptedPayload(encryptedPayload)) {
    throw new Error('Choose a valid encrypted profiles JSON file.');
  }

  try {
    const salt = base64ToBuffer(encryptedPayload.kdf.salt);
    const iv = base64ToBuffer(encryptedPayload.cipher.iv);
    const cipherData = base64ToBuffer(encryptedPayload.cipher.data);

    const key = await deriveAesKey(passphrase, salt, encryptedPayload.kdf.iterations);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(cipherData)
    );

    const decryptedJson = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedJson) as ExportedProfilesV1;
  } catch {
    throw new Error('Could not decrypt profiles. Check the passphrase and try again.');
  }
}

const STORAGE_VAULT_SEED_KEY = '__sec_vault_seed_v1';
let cachedStorageKey: CryptoKey | null = null;

export async function getOrInitLocalStorageKey(): Promise<CryptoKey> {
  if (cachedStorageKey) {
    return cachedStorageKey;
  }

  let seedB64: string | undefined;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await chrome.storage.local.get(STORAGE_VAULT_SEED_KEY);
      seedB64 = result[STORAGE_VAULT_SEED_KEY];
    } catch {}
  }

  let seed: Uint8Array;
  if (typeof seedB64 === 'string' && seedB64.length > 0) {
    seed = base64ToBuffer(seedB64);
  } else {
    seed = crypto.getRandomValues(new Uint8Array(32));
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [STORAGE_VAULT_SEED_KEY]: bufferToBase64(seed) });
      } catch {}
    }
  }

  const appKeyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode('claude-account-switcher-vault-v1')),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(seed),
      iterations: 100000,
      hash: 'SHA-256'
    },
    appKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedStorageKey = derivedKey;
  return derivedKey;
}

export async function encryptProfileCookiesAtRest(
  cookies: import('../types').CookieData[],
  key?: CryptoKey
): Promise<import('../types').EncryptedCookiePayload> {
  const encKey = key ?? (await getOrInitLocalStorageKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(JSON.stringify(cookies ?? []));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    encKey,
    toArrayBuffer(encoded)
  );

  return {
    v: 1,
    iv: bufferToBase64(iv),
    data: bufferToBase64(new Uint8Array(cipherBuffer))
  };
}

export async function decryptProfileCookiesAtRest(
  payload: import('../types').EncryptedCookiePayload,
  key?: CryptoKey
): Promise<import('../types').CookieData[]> {
  if (!payload || typeof payload !== 'object' || payload.v !== 1 || !payload.iv || !payload.data) {
    return [];
  }

  const decKey = key ?? (await getOrInitLocalStorageKey());
  const iv = base64ToBuffer(payload.iv);
  const cipherData = base64ToBuffer(payload.data);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    decKey,
    toArrayBuffer(cipherData)
  );

  const jsonStr = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(jsonStr) as import('../types').CookieData[];
}

export async function encryptProfilesForStorage(
  profiles: Record<string, import('../types').Profile>
): Promise<Record<string, import('../types').StoredProfile>> {
  const key = await getOrInitLocalStorageKey();
  const result: Record<string, import('../types').StoredProfile> = {};

  for (const [id, profile] of Object.entries(profiles)) {
    if (!profile) continue;
    const encryptedCookies = await encryptProfileCookiesAtRest(profile.cookies ?? [], key);
    
    // Stored profile on disk has encryptedCookies and NO raw cookies
    const { cookies: _rawCookies, ...rest } = profile;
    result[id] = {
      ...rest,
      encryptedCookies
    };
  }

  return result;
}

export async function decryptProfilesFromStorage(
  rawProfiles: Record<string, any>
): Promise<{ profiles: Record<string, import('../types').Profile>; migrated: boolean }> {
  const key = await getOrInitLocalStorageKey();
  const profiles: Record<string, import('../types').Profile> = {};
  let migrated = false;

  if (!rawProfiles || typeof rawProfiles !== 'object') {
    return { profiles, migrated: false };
  }

  for (const [id, raw] of Object.entries(rawProfiles)) {
    if (!raw || typeof raw !== 'object') continue;

    let cookies: import('../types').CookieData[] = [];

    if (raw.encryptedCookies && raw.encryptedCookies.v === 1) {
      try {
        cookies = await decryptProfileCookiesAtRest(raw.encryptedCookies, key);
      } catch {
        // Fallback to raw cookies if decryption failed
        cookies = Array.isArray(raw.cookies) ? raw.cookies : [];
      }
    } else if (Array.isArray(raw.cookies)) {
      // Legacy unencrypted profile found on disk -> flag for automatic migration
      cookies = raw.cookies;
      migrated = true;
    }

    profiles[id] = {
      id: raw.id ?? id,
      name: raw.name ?? 'Account',
      email: raw.email,
      plan: raw.plan,
      colorIndex: typeof raw.colorIndex === 'number' ? raw.colorIndex : 0,
      savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
      lastChatUrl: raw.lastChatUrl,
      usage: raw.usage,
      cookies
    };
  }

  return { profiles, migrated };
}
