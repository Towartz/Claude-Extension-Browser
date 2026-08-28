import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distChromeDir = path.resolve(rootDir, 'dist');
const distFirefoxDir = path.resolve(rootDir, 'dist-firefox');

const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.3.0';

function createZip(sourceDir, zipPath, label) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(sourceDir)) {
      return reject(new Error(`Source directory does not exist: ${sourceDir}`));
    }

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const sizeKb = (archive.pointer() / 1024).toFixed(1);
      console.log(`[PASS] ${label} archive created: ${path.basename(zipPath)} (${sizeKb} KB)`);
      resolve({ path: zipPath, sizeKb });
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function packageAll() {
  console.log(`\n--- Packaging Cross-Browser Releases (v${version}) ---`);
  
  // 1. Chrome / Chromium Package
  const chromeZip = path.resolve(rootDir, `claude-account-switcher-chrome-v${version}.zip`);
  const legacyZip = path.resolve(rootDir, `claude-account-switcher-v${version}.zip`);
  await createZip(distChromeDir, chromeZip, 'Chrome (MV3)');
  await createZip(distChromeDir, legacyZip, 'Universal Chrome Release');

  // 2. Firefox Gecko MV3 Package (.zip and .xpi)
  const firefoxZip = path.resolve(rootDir, `claude-account-switcher-firefox-v${version}.zip`);
  const firefoxXpi = path.resolve(rootDir, `claude-account-switcher-firefox-v${version}.xpi`);
  await createZip(distFirefoxDir, firefoxZip, 'Firefox (Gecko MV3 .zip)');
  await createZip(distFirefoxDir, firefoxXpi, 'Firefox (Gecko MV3 .xpi)');

  console.log(`\nAll cross-browser packages generated successfully!`);
}

packageAll().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
