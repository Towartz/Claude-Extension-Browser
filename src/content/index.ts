import { Settings, UsageSession } from '../types';
import { isRateLimitBannerText, parseBannerResetTime } from '../utils/usage';

let currentSettings: Settings = {
  showProgressBar: true,
  notificationsEnabled: false,
  theme: 'auto'
};
let currentUsage: UsageSession = {
  pct: 0,
  resetAt: null
};

let isFetching = false;
let lastRenderedPct: number | null = null;
let lastRenderedColor: string | null = null;
let lastRenderedReset: string | null = null;
let lastRenderedThemeDark: boolean | null = null;
let domObserver: MutationObserver | null = null;
let mutationDebounceTimer: number | null = null;

const POLL_INTERVAL_MS = 15 * 1000;

function isContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function sendExtensionMessage<T>(message: unknown): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      if (!isContextValid()) {
        resolve(undefined);
        return;
      }
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(undefined);
        } else {
          resolve(response);
        }
      });
    } catch {
      resolve(undefined);
    }
  });
}

function scanForDomRateLimit(): boolean {
  try {
    const textContainers = document.querySelectorAll<HTMLElement>(
      'p, div[class*="banner"], div[class*="error"], div[class*="warning"], div[role="alert"], div[class*="toast"], fieldset, form'
    );

    for (let i = textContainers.length - 1; i >= 0; i--) {
      const el = textContainers[i];
      if (!el) continue;
      const text = el.innerText || el.textContent;
      if (text && isRateLimitBannerText(text)) {
        const resetIso = parseBannerResetTime(text);
        if (currentUsage.pct !== 100 || currentUsage.resetAt !== resetIso) {
          currentUsage = {
            pct: 100,
            resetAt: resetIso
          };
          sendExtensionMessage({ type: 'DOM_LIMIT_DETECTED', data: currentUsage });
          return true;
        }
        return true;
      }
    }
  } catch {}
  return false;
}

async function fetchLatestData(): Promise<void> {
  if (!isContextValid()) return;
  if (scanForDomRateLimit()) return;
  if (isFetching || document.hidden) return;
  isFetching = true;
  try {
    const [settingsRes, usageRes] = await Promise.all([
      sendExtensionMessage<{ ok: boolean; data: Settings }>({ type: 'GET_SETTINGS' }),
      sendExtensionMessage<{ ok: boolean; data: UsageSession }>({ type: 'GET_ACTIVE_USAGE' })
    ]);

    if (settingsRes?.ok && settingsRes.data) {
      currentSettings = settingsRes.data;
    }
    if (usageRes?.ok && usageRes.data) {
      if (!scanForDomRateLimit()) {
        currentUsage = usageRes.data;
      }
    }
  } catch {
  } finally {
    isFetching = false;
  }
}

function getUsageColor(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f97316';
  return '#22c55e';
}

function isDarkMode(): boolean {
  try {
    return Boolean(
      document.documentElement?.classList.contains('dark') ||
      document.body?.classList.contains('dark') ||
      document.documentElement?.getAttribute('data-theme') === 'dark' ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  } catch {
    return false;
  }
}

function formatResetCountdown(isoStr: string | null): string {
  if (!isoStr) return '';
  const target = new Date(isoStr).getTime();
  if (!Number.isFinite(target)) return '';
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'resets soon';
  const totalMin = Math.ceil(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    return `resets in ${days}d ${h % 24}h`;
  }
  return h > 0 ? `resets in ${h}h ${m}m` : `resets in ${m}m`;
}

interface AnchorResult {
  parent: HTMLElement;
  referenceNode: Node | null;
}

function findAnchorElement(): AnchorResult | null {
  try {
    // 1. Disclaimer attribute
    const disclaimer = document.querySelector('div[data-disclaimer="true"]');
    if (disclaimer && disclaimer.parentElement && document.body?.contains(disclaimer.parentElement)) {
      return { parent: disclaimer.parentElement, referenceNode: disclaimer };
    }

    // 2. Element containing disclaimer text
    const textElements = document.querySelectorAll('p, div, span, small');
    for (let i = textElements.length - 1; i >= 0; i--) {
      const el = textElements[i];
      if (
        el &&
        el.children.length === 0 &&
        typeof el.textContent === 'string' &&
        /claude (can|may) make mistakes/i.test(el.textContent)
      ) {
        if (el.parentElement && document.body?.contains(el.parentElement)) {
          return { parent: el.parentElement, referenceNode: el };
        }
      }
    }

    // 3. Chat input container or form
    try {
      const inputContainer = document.querySelector(
        'form:has(textarea), fieldset:has(textarea), div[data-testid="chat-input"], form:has([contenteditable="true"])'
      );
      if (inputContainer && inputContainer.parentElement && document.body?.contains(inputContainer.parentElement)) {
        return { parent: inputContainer.parentElement, referenceNode: inputContainer };
      }
    } catch {}

    // 4. Textarea ancestor
    const textarea = document.querySelector('textarea, [contenteditable="true"]');
    if (textarea) {
      let curr: HTMLElement | null = textarea.parentElement;
      while (curr && curr !== document.body) {
        if (curr.classList.contains('w-full') || curr.tagName === 'FORM' || curr.tagName === 'FIELDSET') {
          if (curr.parentElement && document.body?.contains(curr.parentElement)) {
            return { parent: curr.parentElement, referenceNode: curr };
          }
        }
        curr = curr.parentElement;
      }
    }

    // 5. Bottom sticky bar
    const bottomBar = document.querySelector('div[class*="bottom-0"], div[class*="sticky"]');
    if (bottomBar && bottomBar.parentElement && document.body?.contains(bottomBar.parentElement)) {
      return { parent: bottomBar.parentElement, referenceNode: bottomBar };
    }
  } catch {}

  return null;
}

function renderProgressBar(): void {
  try {
    if (currentSettings.showProgressBar === false) {
      const existing = document.getElementById('claude-switcher-progress');
      if (existing) {
        try {
          existing.remove();
        } catch {}
      }
      lastRenderedPct = null;
      lastRenderedColor = null;
      lastRenderedReset = null;
      return;
    }

    const anchor = findAnchorElement();
    if (!anchor || !anchor.parent || !document.body || !document.body.contains(anchor.parent)) return;

    const pct = currentUsage.pct ?? 0;
    const color = getUsageColor(pct);
    const dark = isDarkMode();
    const resetText = formatResetCountdown(currentUsage.resetAt);
    const existingBar = document.getElementById('claude-switcher-progress') as HTMLDivElement | null;

    if (existingBar) {
      if (existingBar.parentElement === anchor.parent) {
        if (
          lastRenderedPct === pct &&
          lastRenderedColor === color &&
          lastRenderedReset === resetText &&
          lastRenderedThemeDark === dark
        ) {
          return;
        }

        const label = existingBar.querySelector<HTMLSpanElement>('#claude-switcher-pct-label');
        if (label) {
          label.textContent = resetText ? `${pct.toFixed(1)}% · ${resetText}` : `${pct.toFixed(1)}%`;
          label.style.color = dark ? '#a1a1aa' : '#6b7280';
        }

        const fill = existingBar.querySelector<HTMLDivElement>('#claude-switcher-bar');
        if (fill) {
          fill.style.width = `${Math.min(100, pct)}%`;
          fill.style.backgroundColor = color;
        }

        const track = existingBar.querySelector<HTMLDivElement>('#claude-switcher-track');
        if (track) {
          track.style.backgroundColor = dark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(229, 231, 235, 0.8)';
        }

        lastRenderedPct = pct;
        lastRenderedColor = color;
        lastRenderedReset = resetText;
        lastRenderedThemeDark = dark;
        return;
      } else {
        try {
          existingBar.remove();
        } catch {}
      }
    }

    const container = document.createElement('div');
    container.id = 'claude-switcher-progress';
    container.className = 'w-full max-w-3xl mx-auto px-4 mb-2 mt-2';
    container.style.width = '100%';
    container.style.maxWidth = '48rem';
    container.style.marginLeft = 'auto';
    container.style.marginRight = 'auto';
    container.style.paddingLeft = '1rem';
    container.style.paddingRight = '1rem';
    container.style.marginTop = '0.5rem';
    container.style.marginBottom = '0.5rem';
    container.style.contain = 'layout paint';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const labelRow = document.createElement('div');
    labelRow.style.display = 'flex';
    labelRow.style.justifyContent = 'space-between';
    labelRow.style.fontSize = '0.75rem';
    labelRow.style.lineHeight = '1rem';
    labelRow.style.color = dark ? '#a1a1aa' : '#6b7280';
    labelRow.style.marginBottom = '0.25rem';
    labelRow.innerHTML = `
      <span style="font-weight: 500;">Claude Usage</span>
      <span id="claude-switcher-pct-label" style="font-weight: 600;">${
        resetText ? `${pct.toFixed(1)}% · ${resetText}` : `${pct.toFixed(1)}%`
      }</span>
    `;

    const track = document.createElement('div');
    track.id = 'claude-switcher-track';
    track.style.width = '100%';
    track.style.height = '6px';
    track.style.backgroundColor = dark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(229, 231, 235, 0.8)';
    track.style.borderRadius = '9999px';
    track.style.overflow = 'hidden';

    const fill = document.createElement('div');
    fill.id = 'claude-switcher-bar';
    fill.style.height = '100%';
    fill.style.borderRadius = '9999px';
    fill.style.transition = 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease';
    fill.style.width = `${Math.min(100, pct)}%`;
    fill.style.backgroundColor = color;

    track.appendChild(fill);
    container.appendChild(labelRow);
    container.appendChild(track);

    if (
      anchor.referenceNode &&
      anchor.referenceNode.parentElement === anchor.parent &&
      anchor.parent.contains(anchor.referenceNode)
    ) {
      anchor.parent.insertBefore(container, anchor.referenceNode);
    } else {
      anchor.parent.appendChild(container);
    }

    lastRenderedPct = pct;
    lastRenderedColor = color;
    lastRenderedReset = resetText;
    lastRenderedThemeDark = dark;
  } catch {}
}

function scheduleRender(): void {
  try {
    requestAnimationFrame(renderProgressBar);
  } catch {}
}

function startDomObserver(): void {
  if (domObserver || typeof MutationObserver === 'undefined') return;
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => startDomObserver(), { once: true });
    }
    return;
  }

  try {
    domObserver = new MutationObserver(() => {
      try {
        scanForDomRateLimit();
        const hasProgressBar = document.getElementById('claude-switcher-progress');
        if (!hasProgressBar) {
          if (mutationDebounceTimer !== null) {
            window.clearTimeout(mutationDebounceTimer);
          }
          mutationDebounceTimer = window.setTimeout(scheduleRender, 100);
        }
      } catch {}
    });

    domObserver.observe(document.body, { childList: true, subtree: true });
  } catch {}
}

function handleNavigation(): void {
  scheduleRender();
  setTimeout(scheduleRender, 300);
  setTimeout(scheduleRender, 800);
}

function init(): void {
  try {
    fetchLatestData().then(scheduleRender).catch(() => {});

    startDomObserver();

    window.setInterval(() => {
      try {
        if (!isContextValid()) return;
        if (!document.hidden) {
          fetchLatestData().then(scheduleRender).catch(() => {});
        }
      } catch {}
    }, POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      try {
        if (!isContextValid()) return;
        if (!document.hidden) {
          fetchLatestData().then(scheduleRender).catch(() => {});
        }
      } catch {}
    });

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        try {
          if (msg && msg.type === 'USAGE_UPDATED' && msg.data) {
            currentUsage = msg.data;
            scheduleRender();
          }
        } catch {}
      });
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        try {
          if (areaName === 'local' && changes.claude_settings) {
            currentSettings = { ...currentSettings, ...changes.claude_settings.newValue };
            if (currentSettings.showProgressBar) {
              scheduleRender();
              fetchLatestData().then(scheduleRender).catch(() => {});
            } else {
              const existing = document.getElementById('claude-switcher-progress');
              if (existing) {
                try {
                  existing.remove();
                } catch {}
              }
              lastRenderedPct = null;
              lastRenderedColor = null;
              lastRenderedReset = null;
            }
          }
        } catch {}
      });
    }
  } catch {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init(), { once: true });
} else {
  init();
}

