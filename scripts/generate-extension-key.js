import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Generating Brand New Chrome Extension ID & Public Key ---');

// 1. Generate 2048-bit RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'der'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

const base64Key = publicKey.toString('base64');

// 2. Compute 32-character Chrome Extension ID
const sha256Hex = crypto.createHash('sha256').update(publicKey).digest('hex');
const extensionId = sha256Hex
  .slice(0, 32)
  .split('')
  .map((c) => String.fromCharCode(parseInt(c, 16) + 'a'.charCodeAt(0)))
  .join('');

console.log(`[SUCCESS] New Extension ID: ${extensionId}`);
console.log(`[SUCCESS] Base64 Key Length: ${base64Key.length} chars`);

// 3. Update scripts/copy-manifest.js with new key
const copyManifestPath = path.resolve(__dirname, 'copy-manifest.js');
let copyManifestContent = fs.readFileSync(copyManifestPath, 'utf8');

// Replace key in copy-manifest.js
const keyRegex = /key:\s*['"][^'"]+['"]/g;
if (keyRegex.test(copyManifestContent)) {
  copyManifestContent = copyManifestContent.replace(keyRegex, `key: '${base64Key}'`);
} else {
  // Insert key property
  copyManifestContent = copyManifestContent.replace(
    /version:\s*'0\.2\.3',/g,
    `version: '0.2.3',\n  key: '${base64Key}',`
  );
}
fs.writeFileSync(copyManifestPath, copyManifestContent, 'utf8');

// 4. Update root manifest.json
const rootManifestPath = path.resolve(rootDir, 'manifest.json');
const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
rootManifest.key = base64Key;
fs.writeFileSync(rootManifestPath, JSON.stringify(rootManifest, null, 2) + '\n', 'utf8');

console.log(`[SUCCESS] Updated manifest.json and scripts/copy-manifest.js with new key.`);
console.log(`\nNew Extension ID is: ${extensionId}`);
