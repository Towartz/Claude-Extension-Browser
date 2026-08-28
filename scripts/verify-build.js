import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log('--- Verifying Extension Build ---');

// 1. Check dist/manifest.json
const manifestPath = path.resolve(distDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('FAIL: dist/manifest.json not found!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log(`[PASS] Manifest Version: ${manifest.manifest_version}`);
console.log(`[PASS] Extension Name: ${manifest.name}`);
console.log(`[PASS] Version: ${manifest.version}`);

// 2. Check Action Popup HTML & ensure no .tsx references
const popupPath = path.resolve(distDir, manifest.action.default_popup);
if (!fs.existsSync(popupPath)) {
  console.error(`FAIL: Popup HTML not found at ${popupPath}`);
  process.exit(1);
}
const popupHtmlContent = fs.readFileSync(popupPath, 'utf8');
if (popupHtmlContent.includes('.tsx')) {
  console.error(`FAIL: Popup HTML at ${popupPath} contains uncompiled .tsx references!`);
  process.exit(1);
}
if (popupHtmlContent.includes('modulepreload')) {
  console.error(`FAIL: Popup HTML at ${popupPath} contains modulepreload tags!`);
  process.exit(1);
}
if (popupHtmlContent.includes('crossorigin')) {
  console.error(`FAIL: Popup HTML at ${popupPath} contains crossorigin attributes!`);
  process.exit(1);
}
console.log(`[PASS] Popup HTML is clean (0 modulepreload, 0 crossorigin, compiled JS): ${manifest.action.default_popup}`);

// 3. Check Icons
for (const [size, iconRel] of Object.entries(manifest.icons || {})) {
  const iconPath = path.resolve(distDir, iconRel);
  if (!fs.existsSync(iconPath)) {
    console.error(`FAIL: Icon (${size}) not found at ${iconPath}`);
    process.exit(1);
  }
  console.log(`[PASS] Icon ${size}x${size} exists: ${iconRel}`);
}

// 4. Check Background Service Worker
const swPath = path.resolve(distDir, manifest.background.service_worker);
if (!fs.existsSync(swPath)) {
  console.error(`FAIL: Service Worker not found at ${swPath}`);
  process.exit(1);
}
console.log(`[PASS] Service Worker exists: ${manifest.background.service_worker}`);

// 5. Check Content Scripts
for (const cs of manifest.content_scripts || []) {
  for (const js of cs.js || []) {
    const csPath = path.resolve(distDir, js);
    if (!fs.existsSync(csPath)) {
      console.error(`FAIL: Content script not found at ${csPath}`);
      process.exit(1);
    }
    const csContent = fs.readFileSync(csPath, 'utf8');
    if (/^\s*import\s+/m.test(csContent) || /\bfrom\s*['"][^'"]+['"]/m.test(csContent)) {
      console.error(`FAIL: Content script at ${csPath} contains forbidden ES module import statements!`);
      process.exit(1);
    }
    console.log(`[PASS] Content script exists and is self-contained (0 imports): ${js} (matches: ${cs.matches.join(', ')})`);
  }
}

// 6. Check root manifest compatibility
const rootManifestPath = path.resolve(rootDir, 'manifest.json');
if (fs.existsSync(rootManifestPath)) {
  const rootM = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
  const rootPopupPath = path.resolve(rootDir, rootM.action.default_popup);
  if (!fs.existsSync(rootPopupPath)) {
    console.error(`FAIL: Root manifest points to missing popup: ${rootPopupPath}`);
    process.exit(1);
  }
  console.log(`[PASS] Root manifest compatibility verified: points to ${rootM.action.default_popup}`);
}

// 7. Check ZIP package
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.3.0';
const zipPath = path.resolve(rootDir, `claude-account-switcher-v${version}.zip`);
if (!fs.existsSync(zipPath)) {
  console.error(`FAIL: Zip package not found at ${zipPath}!`);
  process.exit(1);
}
const stats = fs.statSync(zipPath);
console.log(`[PASS] Release zip archive exists: ${path.basename(zipPath)} (${(stats.size / 1024).toFixed(1)} KB)`);

console.log('\nAll automated extension verification checks passed successfully!');
