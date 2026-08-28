# Claude Account Switcher (Cross-Browser Extension)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)
![React 19](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)
![Chrome](https://img.shields.io/badge/Chrome-Supported-4285F4.svg)
![Firefox](https://img.shields.io/badge/Firefox-Supported-FF7139.svg)
![Edge](https://img.shields.io/badge/Edge-Supported-0078D7.svg)
![Brave](https://img.shields.io/badge/Brave-Supported-FB542B.svg)

A cross-browser extension (Manifest V3) for switching Claude.ai accounts in one click, managing multi-account sessions, predicting peak capacity hours, tracking limits with a live usage bar, and organizing saved profiles with AES-GCM-256 encrypted backups.

---

## Features

- **Instant Account Switching**: Switch between unlimited Claude accounts with zero page lag.
- **Unsaved Session Protection**: Confirms and warns before switching away from an unsaved active profile.
- **Real-Time Usage Dashboard**:
  - 5-hour session progress gauge with live countdown timer.
  - 7-day weekly cap bar and toolbar ring preview.
  - Model usage breakdown (Opus, Sonnet, Haiku, Claude Design).
  - 30-day activity heatmap (7x24 hourly activity matrix).
- **Predictive Peak Traffic Forecast**:
  - Live 1-second real-time countdown timer.
  - Multi-scenario global load index (Core Weekday Peak, Afternoon, Off-Peak Night, and Weekend Leisure).
  - Visual 24-Hour Local Timeline Bar with color-coded traffic slots and live local time indicator.
  - Converts Claude global peak schedule (5:00 AM - 1:00 PM PT) to user local timezone.
- **In-Page Progress Bar**: Injects a clean, color-coded usage progress bar directly above the disclaimer banner on claude.ai.
- **Encrypted Backup and Transfer**:
  - Export profiles encrypted with PBKDF2-SHA256 (210,000 iterations) + AES-GCM-256 with custom passphrase.
  - Drag-and-drop JSON import.
- **Adaptive Theme**: Auto (System OS), Light, and Dark mode support.
- **Local-First and Zero Analytics**: Session tokens and cookies never leave your browser storage.

---

## Installation Guide

### Google Chrome / Brave / Microsoft Edge / Opera
1. Download or clone this repository.
2. Run `npm install` and `npm run package`.
3. Open your browser and navigate to `chrome://extensions/` (or `brave://extensions/`, `edge://extensions/`).
4. Enable Developer mode in the top right corner.
5. Click Load unpacked and select the `dist/` (or `dist-chrome/`) folder.
6. Open [claude.ai](https://claude.ai/) and click the extension icon to manage accounts.

### Mozilla Firefox
1. Run `npm install` and `npm run package`.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click Load Temporary Add-on...
4. Select the `dist-firefox/manifest.json` file (or select `claude-account-switcher-firefox-v0.3.0.zip`).
5. The extension is now active on [claude.ai](https://claude.ai/).

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
- `claude-account-switcher-chrome-v0.3.0.zip` - Chrome release archive
- `claude-account-switcher-firefox-v0.3.0.zip` - Firefox release archive
- `claude-account-switcher-firefox-v0.3.0.xpi` - Firefox XPI package

---

## Architecture and Project Structure

```
├── dist-chrome/              # Chrome / Chromium target (MV3)
├── dist-firefox/             # Firefox target (Gecko MV3)
├── src/                      # TypeScript / React 19 source
│   ├── background/           # Background Service Worker
│   ├── content/              # Injected Content Script (claude.ai)
│   ├── popup/                # React 19 SPA Popup UI
│   │   ├── components/       # UI Components (PeakBanner, UsagePanel, ProfileList, etc.)
│   │   ├── hooks/            # Custom Hooks (useProfiles, useDashboard, useSettings)
│   │   ├── App.tsx           # Main Shell
│   │   └── index.css         # High-contrast adaptive styling
│   ├── types/                # TypeScript Interfaces and Models
│   └── utils/                # Crypto, Usage, Cookies, Profiles utilities
├── scripts/                  # Cross-Browser Build and Packaging Scripts
│   ├── build-cross-browser.js
│   ├── package-all.js
│   └── verify-cross-browser.js
└── package.json
```

---

## License

MIT License.
