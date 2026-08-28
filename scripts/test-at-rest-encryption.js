import assert from 'assert';
import crypto from 'crypto';

// WebCrypto Subtle compatibility in Node.js
const webCrypto = globalThis.crypto.subtle;

const IV_BYTES = 12;

function bufferToBase64(buffer) {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function toArrayBuffer(arr) {
  const buffer = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buffer).set(arr);
  return buffer;
}

async function createTestKey() {
  const seed = crypto.randomBytes(32);
  const appKeyMaterial = await webCrypto.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode('claude-account-switcher-vault-v1')),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return webCrypto.deriveKey(
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
}

async function encryptCookies(cookies, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const encoded = new TextEncoder().encode(JSON.stringify(cookies ?? []));

  const cipherBuffer = await webCrypto.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );

  return {
    v: 1,
    iv: bufferToBase64(iv),
    data: bufferToBase64(new Uint8Array(cipherBuffer))
  };
}

async function decryptCookies(payload, key) {
  const iv = base64ToBuffer(payload.iv);
  const cipherData = base64ToBuffer(payload.data);

  const decryptedBuffer = await webCrypto.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(cipherData)
  );

  const jsonStr = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(jsonStr);
}

console.log('--- Testing At-Rest AES-GCM-256 Storage Encryption (Anti-Stealer) ---');

async function runTests() {
  const key = await createTestKey();

  const sampleCookies = [
    {
      name: 'sessionKey',
      value: 'sk-ant-sid01-abcdef1234567890-SECRET-TOKEN-DO-NOT-LEAK',
      domain: '.claude.ai',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      session: false,
      expirationDate: 1780000000
    },
    {
      name: 'cf_clearance',
      value: 'cf_clearance_sample_token_xyz',
      domain: 'claude.ai',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'no_restriction',
      session: true
    }
  ];

  // 1. Encrypt cookies
  const encrypted = await encryptCookies(sampleCookies, key);
  
  // Verify structure
  assert.strictEqual(encrypted.v, 1);
  assert.ok(typeof encrypted.iv === 'string' && encrypted.iv.length > 0);
  assert.ok(typeof encrypted.data === 'string' && encrypted.data.length > 0);

  // 2. Critical Security Check: Verify that raw token strings DO NOT appear in stored payload
  const stringifiedPayload = JSON.stringify(encrypted);
  assert.strictEqual(stringifiedPayload.includes('sk-ant-sid01'), false);
  assert.strictEqual(stringifiedPayload.includes('SECRET-TOKEN-DO-NOT-LEAK'), false);
  assert.strictEqual(stringifiedPayload.includes('cf_clearance_sample_token'), false);
  console.log(' [PASS] Zero plaintext tokens found in ciphertext payload');

  // 3. Decrypt cookies
  const decrypted = await decryptCookies(encrypted, key);
  assert.strictEqual(decrypted.length, 2);
  assert.strictEqual(decrypted[0].name, 'sessionKey');
  assert.strictEqual(decrypted[0].value, 'sk-ant-sid01-abcdef1234567890-SECRET-TOKEN-DO-NOT-LEAK');
  assert.strictEqual(decrypted[0].httpOnly, true);
  assert.strictEqual(decrypted[0].secure, true);
  assert.strictEqual(decrypted[1].name, 'cf_clearance');
  console.log(' [PASS] AES-GCM-256 round-trip cookie integrity verified');

  // 4. Test Stored Profile Batch Transformation
  const mockProfiles = {
    'prof-1': {
      id: 'prof-1',
      name: 'Pro Account',
      email: 'alex@company.com',
      colorIndex: 2,
      savedAt: 1724800000000,
      cookies: sampleCookies
    }
  };

  // Encrypt batch
  const storedBatch = {};
  for (const [id, prof] of Object.entries(mockProfiles)) {
    const encCookies = await encryptCookies(prof.cookies, key);
    const { cookies: _raw, ...rest } = prof;
    storedBatch[id] = { ...rest, encryptedCookies: encCookies };
  }

  assert.strictEqual(storedBatch['prof-1'].cookies, undefined);
  assert.ok(storedBatch['prof-1'].encryptedCookies);
  console.log(' [PASS] Batch profile encryption stripped raw cookies from disk structure');

  // Decrypt batch
  const restoredProfiles = {};
  for (const [id, raw] of Object.entries(storedBatch)) {
    const cookies = await decryptCookies(raw.encryptedCookies, key);
    restoredProfiles[id] = { ...raw, cookies };
  }

  assert.strictEqual(restoredProfiles['prof-1'].cookies.length, 2);
  assert.strictEqual(restoredProfiles['prof-1'].cookies[0].value, 'sk-ant-sid01-abcdef1234567890-SECRET-TOKEN-DO-NOT-LEAK');
  console.log(' [PASS] Restored in-memory profiles match original');

  console.log('\nAll At-Rest Storage Encryption tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
