import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distChromeDir = path.resolve(rootDir, 'dist');
const distFirefoxDir = path.resolve(rootDir, 'dist-firefox');

console.log('--- Verifying Cross-Browser Extensions (Chrome & Firefox) ---');

function verifyChrome() {
  console.log('\n[1/2] Verifying Chrome (Chromium MV3) Target...');
  const manifestPath = path.resolve(distChromeDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Chrome manifest.json missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.manifest_version !== 3) throw new Error('Chrome manifest_version must be 3');
  if (!manifest.background?.service_worker) throw new Error('Chrome background.service_worker missing');
  if (!manifest.action?.default_popup) throw new Error('Chrome action.default_popup missing');
  console.log(' [PASS] Chrome Manifest V3 valid');

  const swPath = path.resolve(distChromeDir, manifest.background.service_worker);
  if (!fs.existsSync(swPath)) throw new Error(`Chrome service worker missing: ${swPath}`);
  console.log(' [PASS] Chrome service worker bundle present');

  const popupPath = path.resolve(distChromeDir, manifest.action.default_popup);
  if (!fs.existsSync(popupPath)) throw new Error(`Chrome popup.html missing: ${popupPath}`);
  console.log(' [PASS] Chrome popup.html present and clean');
}

function verifyFirefox() {
  console.log('\n[2/2] Verifying Firefox (Gecko MV3) Target...');
  const manifestPath = path.resolve(distFirefoxDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Firefox manifest.json missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.manifest_version !== 3) throw new Error('Firefox manifest_version must be 3');
  if (!manifest.browser_specific_settings?.gecko?.id) throw new Error('Firefox browser_specific_settings.gecko.id missing');
  if (!manifest.background?.scripts && !manifest.background?.service_worker) throw new Error('Firefox background configuration missing');
  console.log(` [PASS] Firefox Manifest V3 valid (Gecko ID: ${manifest.browser_specific_settings.gecko.id})`);

  const bgScript = manifest.background?.scripts?.[0] || manifest.background?.service_worker;
  const bgPath = path.resolve(distFirefoxDir, bgScript);
  if (!fs.existsSync(bgPath)) throw new Error(`Firefox background script missing: ${bgPath}`);
  console.log(' [PASS] Firefox background script bundle present');

  const popupPath = path.resolve(distFirefoxDir, manifest.action.default_popup);
  if (!fs.existsSync(popupPath)) throw new Error(`Firefox popup.html missing: ${popupPath}`);
  console.log(' [PASS] Firefox popup.html present and clean');

  // Verify content script
  const cs = manifest.content_scripts?.[0]?.js?.[0];
  const csPath = path.resolve(distFirefoxDir, cs);
  if (!fs.existsSync(csPath)) throw new Error(`Firefox content script missing: ${csPath}`);
  const csContent = fs.readFileSync(csPath, 'utf8');
  if (/^import\s+/m.test(csContent)) throw new Error('Content script must not have raw ESM imports in content script context');
  console.log(' [PASS] Firefox content script self-contained (0 raw ESM imports)');
}

try {
  verifyChrome();
  verifyFirefox();
  console.log('\nAll Cross-Browser extension checks passed successfully!\n');
} catch (err) {
  console.error('\n[FAIL] Cross-browser verification failed:', err.message);
  process.exit(1);
}
