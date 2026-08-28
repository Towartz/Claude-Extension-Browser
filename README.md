# Claude Account Switcher (Cross-Browser Extension)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)
![Version](https://img.shields.io/badge/version-0.3.1-green.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)
![React 19](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)
![Chrome](https://img.shields.io/badge/Chrome-Supported-4285F4.svg)
![Firefox](https://img.shields.io/badge/Firefox-Supported-FF7139.svg)
![Edge](https://img.shields.io/badge/Edge-Supported-0078D7.svg)
![Brave](https://img.shields.io/badge/Brave-Supported-FB542B.svg)

A high-performance, secure cross-browser extension (Manifest V3) for switching Claude.ai accounts in one click, managing multi-account sessions, predicting peak capacity hours, tracking limits with a live usage bar, protecting local session data against infostealers with at-rest AES-GCM-256 encryption, and organizing saved profiles.

---

## Features

- **Instant Account Switching**: Switch between unlimited Claude accounts with zero page lag.
- **At-Rest AES-GCM-256 Storage Encryption (Anti-Stealer)**: All session keys and cookie payloads stored on disk are encrypted using Web Crypto AES-GCM-256 with 96-bit random IVs. Raw session tokens never exist as plaintext in LevelDB database files on disk, protecting credentials from local infostealer malware.
- **Light / Readable Email Privacy Masking**: Privacy-preserving email masking (e.g. `towar***work@gmail.com` vs `towart***rsonal@gmail.com`) that keeps distinguishing suffixes visible so similar accounts are easy to recognize.
- **Interactive Eye Toggle**: Clickable eye icon on every account email allows one-click toggling between masked and unmasked view.
- **Unsaved Session Protection**: Confirms and warns before switching away from an active session that has not yet been saved to your profile list.
- **Real-Time Usage Dashboard**:
  - 5-hour session progress gauge with live countdown timer.
  - 7-day weekly cap bar and toolbar ring preview.
  - Model usage breakdown (Opus, Sonnet, Haiku, Claude Design).
  - 30-day activity heatmap (7x24 hourly activity matrix).
- **Predictive Peak Traffic Forecast**:
  - Live 1-second real-time countdown timer.
  - Multi-scenario global load index (Core Weekday Peak, Afternoon, Off-Peak Night, and Weekend Leisure).
  - Visual 24-Hour Local Timeline Bar with color-coded traffic slots and live local time indicator needle.
  - Automatic time zone conversion to user local schedule.
- **In-Page Progress Bar**: Injects a clean, color-coded usage progress bar directly above the disclaimer banner on claude.ai.
- **Encrypted Backup and Transfer**:
  - Export profiles encrypted with PBKDF2-SHA256 (210,000 iterations) + AES-GCM-256 with custom user passphrase.
  - Drag-and-drop JSON import.
- **Adaptive Theme**: Auto (System OS), Light, and Dark mode support.
- **Zero Telemetry**: All cookies and operations stay strictly on your local device.

---

## Platform Installation Guides

### Google Chrome
1. Download `claude-account-switcher-chrome-v0.3.1.zip` from [Releases](https://github.com/Towartz/Claude-Extension-Browser/releases).
2. Extract the ZIP archive to a folder on your computer.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable the **Developer mode** toggle in the top right corner.
5. Click **Load unpacked** in the top left corner.
6. Select the extracted directory.
7. Open [claude.ai](https://claude.ai/) and click the extension icon to manage your accounts.

### Mozilla Firefox
1. Download `claude-account-switcher-firefox-v0.3.1.zip` or `claude-account-switcher-firefox-v0.3.1.xpi` from [Releases](https://github.com/Towartz/Claude-Extension-Browser/releases).
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select the downloaded `.zip` or `.xpi` file (or `dist-firefox/manifest.json` if building from source).
5. The extension is now active on [claude.ai](https://claude.ai/).

### Brave Browser
1. Download and extract `claude-account-switcher-chrome-v0.3.1.zip`.
2. Open Brave and navigate to `brave://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extracted folder.
5. The extension works seamlessly alongside Brave Shields.

### Microsoft Edge
1. Download and extract `claude-account-switcher-chrome-v0.3.1.zip`.
2. Open Microsoft Edge and navigate to `edge://extensions/`.
3. Turn on the **Developer mode** toggle on the left sidebar.
4. Click **Load unpacked** and select the extracted folder.

### Opera / Vivaldi
1. Download and extract `claude-account-switcher-chrome-v0.3.1.zip`.
2. Open your browser and go to `opera://extensions/` or `vivaldi://extensions/`.
3. Enable **Developer mode** and click **Load unpacked**.

---

## Development and Build Pipeline

```bash
# 1. Install dependencies
npm install

# 2. Type checking
npm run typecheck

# 3. Build for all platforms (Chrome and Firefox)
npm run build

# 4. Package release archives (.zip for Chrome, .zip/.xpi for Firefox)
npm run package

# 5. Run test verification suite
npm test
```

### Build Artifacts Output
- `dist/` and `dist-chrome/` - Chrome / Chromium MV3 unpacked directory
- `dist-firefox/` - Firefox Gecko MV3 unpacked directory
- `releases/claude-account-switcher-chrome-v0.3.1.zip` - Chrome release archive
- `releases/claude-account-switcher-firefox-v0.3.1.zip` - Firefox release archive
- `releases/claude-account-switcher-firefox-v0.3.1.xpi` - Firefox direct installable XPI package
- `releases/claude-account-switcher-v0.3.1.zip` - Universal release package

---

## License

MIT License. Copyright (c) 2026 Towartz.
