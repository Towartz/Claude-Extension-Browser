import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const distFirefoxDir = path.resolve(rootDir, 'dist-firefox');
const distChromeDir = path.resolve(rootDir, 'dist-chrome');

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.3.0';

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Ensure icons exist in dist/icons
const distIconsDir = path.resolve(distDir, 'icons');
if (!fs.existsSync(distIconsDir)) {
  fs.mkdirSync(distIconsDir, { recursive: true });
}

const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png'];
for (const icon of iconFiles) {
  const srcPublic = path.resolve(rootDir, 'public', icon);
  const srcRoot = path.resolve(rootDir, icon);
  const target = path.resolve(distIconsDir, icon);

  if (fs.existsSync(srcPublic)) {
    fs.copyFileSync(srcPublic, target);
  } else if (fs.existsSync(srcRoot)) {
    fs.copyFileSync(srcRoot, target);
  }
}

function sanitizeExtensionHtml(html, isRootPopup = false) {
  let cleaned = html
    .replace(/<link\s+rel=["']modulepreload["'][^>]*>\s*/gi, '')
    .replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');
  if (isRootPopup) {
    cleaned = cleaned.replace(/\.\.\/\.\.\/assets\//g, './assets/');
  }
  return cleaned;
}

// 2. Sanitize popup HTML
const srcPopupBuiltHtml = path.resolve(distDir, 'src', 'popup', 'index.html');
const distPopupHtml = path.resolve(distDir, 'popup.html');

if (fs.existsSync(srcPopupBuiltHtml)) {
  const original = fs.readFileSync(srcPopupBuiltHtml, 'utf8');
  fs.writeFileSync(srcPopupBuiltHtml, sanitizeExtensionHtml(original, false), 'utf8');
  fs.writeFileSync(distPopupHtml, sanitizeExtensionHtml(original, true), 'utf8');
}

// 3. Create Chrome Manifest V3
const chromeManifest = {
  manifest_version: 3,
  name: 'Claude Account Switcher',
  version: version,
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkwwo+MUv57kLdwzrs+qEf6TL/HVwz6UHjAYdzRlSPN9S1gd00ioNs/zE7kp6ESKb9B91a2YLJf3PwvQZR308BtiLZCx30BrptU2CcLzEhYZxTNYgosZWH5PPTDmDhUWbm8jD3hpz8I+TTyLHYd+OxeYCAxX50SOe6HqmN6EgCF/ufTHMHWkI6HFXS+Z8onHjD9z55lqLW0LGonsOC8dmpcfGPTGmTc+qQtd9isn+LTkz6eaviFg0X2Dwm1JWRLFw2O+lqg81BRDIwl2/NDNWryaUvf5Jh3rxlwuy82JhpllrbOFvbv4zCkantTnn0DIQ5gc3qGLNwPhQRJ9iFBZCqwIDAQAB',
  description:
    'Switch Claude.ai accounts in one click. Manage multi-account sessions, track limits with a usage bar, and organize saved profiles.',
  permissions: ['cookies', 'storage', 'tabs', 'webRequest'],
  host_permissions: ['https://claude.ai/*'],
  action: {
    default_popup: 'popup.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  },
  background: {
    service_worker: 'service-worker.js',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['https://claude.ai/*'],
      js: ['content-script.js'],
      run_at: 'document_idle'
    }
  ],
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png'
  }
};

fs.writeFileSync(
  path.resolve(distDir, 'manifest.json'),
  JSON.stringify(chromeManifest, null, 2) + '\n',
  'utf8'
);

// Synchronize root manifest.json to point to dist for dual-folder loading in Chrome
const rootManifest = {
  ...chromeManifest,
  action: {
    default_popup: 'dist/popup.html',
    default_icon: {
      '16': 'dist/icons/icon16.png',
      '48': 'dist/icons/icon48.png',
      '128': 'dist/icons/icon128.png'
    }
  },
  background: {
    service_worker: 'dist/service-worker.js',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['https://claude.ai/*'],
      js: ['dist/content-script.js'],
      run_at: 'document_idle'
    }
  ],
  icons: {
    '16': 'dist/icons/icon16.png',
    '48': 'dist/icons/icon48.png',
    '128': 'dist/icons/icon128.png'
  }
};

fs.writeFileSync(
  path.resolve(rootDir, 'manifest.json'),
  JSON.stringify(rootManifest, null, 2) + '\n',
  'utf8'
);

// 4. Create Chrome dedicated folder
copyDirRecursive(distDir, distChromeDir);

// 5. Create Firefox dedicated folder & Manifest V3
const firefoxManifest = {
  manifest_version: 3,
  name: 'Claude Account Switcher',
  version: version,
  description:
    'Switch Claude.ai accounts in one click. Manage multi-account sessions, track limits with a usage bar, and organize saved profiles.',
  permissions: ['cookies', 'storage', 'tabs', 'webRequest'],
  host_permissions: ['https://claude.ai/*'],
  action: {
    default_popup: 'popup.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  },
  background: {
    scripts: ['service-worker.js']
  },
  content_scripts: [
    {
      matches: ['https://claude.ai/*'],
      js: ['content-script.js'],
      run_at: 'document_idle'
    }
  ],
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png'
  },
  browser_specific_settings: {
    gecko: {
      id: 'claude-account-switcher@towartz.dev',
      strict_min_version: '115.0'
    }
  }
};

copyDirRecursive(distDir, distFirefoxDir);
fs.writeFileSync(
  path.resolve(distFirefoxDir, 'manifest.json'),
  JSON.stringify(firefoxManifest, null, 2) + '\n',
  'utf8'
);

console.log('Successfully built cross-browser packages:');
console.log(' - Chrome / Chromium target: dist/ & dist-chrome/');
console.log(' - Firefox Gecko MV3 target: dist-firefox/');
