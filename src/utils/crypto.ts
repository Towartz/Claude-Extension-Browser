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
