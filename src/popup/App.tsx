import React, { useEffect, useRef, useState } from 'react';
import { AddProfileForm } from './components/AddProfileForm';
import { ErrorBanner } from './components/ErrorBanner';
import { AppBrandMark, Icon } from './components/Icons';
import { ProfileList } from './components/ProfileList';
import { TransferPanel } from './components/TransferPanel';
import { UsagePanel } from './components/UsagePanel';
import { PeakBanner } from './components/PeakBanner';
import { ConfirmModal } from './components/ConfirmModal';
import { useClaudeTab } from './hooks/useClaudeTab';
import { useDashboard } from './hooks/useDashboard';
import { useProfiles } from './hooks/useProfiles';
import { useSettings } from './hooks/useSettings';
import { Profile } from '../types';

async function navigateToClaude(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
    const [tab] = await chrome.tabs.query({ url: 'https://claude.ai/*' });
    if (tab?.id !== undefined) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined && chrome.windows !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return;
    }
    await chrome.tabs.create({ url: 'https://claude.ai/' });
    return;
  }
  window.open('https://claude.ai/', '_blank', 'noopener,noreferrer');
}

const TABS = [
  { id: 'profiles', label: 'Profiles' },
  { id: 'transfer', label: 'Import / Export' }
] as const;

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'transfer'>('profiles');
  const { isClaudeTab } = useClaudeTab();
  const profileHook = useProfiles();
  const { settings, updateSettings } = useSettings();
  const {
    dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    refresh: refreshDashboard
  } = useDashboard();

  const [profilePendingDelete, setProfilePendingDelete] = useState<Profile | null>(null);
  const [profilePendingSwitch, setProfilePendingSwitch] = useState<Profile | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const profileList = Object.values(profileHook.profiles).sort((a, b) => b.savedAt - a.savedAt);
  const activeProfile =
    profileHook.activeProfileId !== undefined
      ? profileHook.profiles[profileHook.activeProfileId]
      : undefined;

  const isBusy = profileHook.busyState !== 'idle';

  const handleSwitchRequest = (targetId: string) => {
    const target = profileHook.profiles[targetId];
    if (!target) return;

    // Warn ONLY when switching away from an unsaved profile session
    if (profileHook.activeProfileId === undefined) {
      setProfilePendingSwitch(target);
    } else {
      profileHook.switchProfile(targetId);
    }
  };

  // Roving-tabindex arrow-key navigation, per the WAI-ARIA tabs pattern —
  // Left/Right (and Home/End) move focus and activate the corresponding tab.
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = TABS.length - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      const nextTab = TABS[nextIndex];
      setActiveTab(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  return (
    <main className="popup-app">
      <header className="popup-header">
        <div className="brand">
          <AppBrandMark />
          <div className="brand-text">
            <h1 className="title">Claude Account Switcher</h1>
            <p className="subtitle">Instant account switcher & usage</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="theme-toggle" role="group" aria-label="Theme selector">
            <button
              type="button"
              className={`theme-chip ${settings.theme === 'light' ? 'active' : ''}`}
              title="Light theme"
              aria-label="Light theme"
              aria-pressed={settings.theme === 'light'}
              onClick={() => updateSettings({ theme: 'light' })}
            >
              <Icon name="sun" size={12} />
              <span>Light</span>
            </button>
            <button
              type="button"
              className={`theme-chip ${settings.theme === 'dark' ? 'active' : ''}`}
              title="Dark theme"
              aria-label="Dark theme"
              aria-pressed={settings.theme === 'dark'}
              onClick={() => updateSettings({ theme: 'dark' })}
            >
              <Icon name="moon" size={12} />
              <span>Dark</span>
            </button>
            <button
              type="button"
              className={`theme-chip ${settings.theme === 'auto' ? 'active' : ''}`}
              title="Auto theme (matches OS)"
              aria-label="Auto theme"
              aria-pressed={settings.theme === 'auto'}
              onClick={() => updateSettings({ theme: 'auto' })}
            >
              <Icon name="monitor" size={12} />
              <span>Auto</span>
            </button>
          </div>

          <label className="usage-bar-toggle" title="Show usage bar in Claude">
            <input
              type="checkbox"
              id="showProgressBar"
              checked={settings.showProgressBar}
              onChange={(e) => updateSettings({ showProgressBar: e.target.checked })}
              aria-label="Show usage bar in Claude"
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </label>
        </div>
      </header>

      <nav className="popup-tabs" aria-label="Popup sections" role="tablist">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            type="button"
            id={`tab-${tab.id}`}
            role="tab"
            className={activeTab === tab.id ? 'active' : ''}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'profiles' ? (
        <section
          id="panel-profiles"
          className="tab-panel profiles-panel"
          aria-label="Profile management"
          aria-labelledby="tab-profiles"
          role="tabpanel"
          tabIndex={0}
        >
          {!isClaudeTab && (
            <ErrorBanner
              message="Open claude.ai to use this extension."
              actionLabel="Go to Claude.ai"
              onAction={navigateToClaude}
            />
          )}

          {profileHook.error !== null && (
            <ErrorBanner message={profileHook.error} onDismiss={profileHook.clearError} />
          )}

          {dashboardError !== null && <ErrorBanner message={dashboardError} />}

          <PeakBanner peak={dashboard.peak} />

          <ProfileList
            profiles={profileList}
            activeProfileId={profileHook.activeProfileId}
            isClaudeTab={isClaudeTab}
            loading={profileHook.loading}
            busyState={profileHook.busyState}
            onSwitch={handleSwitchRequest}
            onDelete={setProfilePendingDelete}
            onRename={profileHook.rename}
          />

          {profileHook.activeProfileId === undefined && (
            <AddProfileForm
              onSave={profileHook.save}
              existingNames={profileList.map((p) => p.name)}
              disabled={isBusy || profileHook.loading || !isClaudeTab}
              nextColorIndex={profileList.length % 5}
            />
          )}

          <button
            type="button"
            className="sw add-account-button"
            disabled={isBusy || profileHook.loading || !isClaudeTab}
            onClick={profileHook.clearCookies}
          >
            {profileHook.busyState === 'clearing' ? 'Preparing...' : 'Add another account'}
          </button>

          <UsagePanel
            dashboard={dashboard}
            loading={dashboardLoading}
            activeProfileName={activeProfile?.name}
            onRefresh={() => refreshDashboard(true)}
          />
        </section>
      ) : (
        <div id="panel-transfer" role="tabpanel" aria-label="Import and export profiles" aria-labelledby="tab-transfer" tabIndex={0}>
          <TransferPanel
            profilesCount={profileList.length}
            loading={profileHook.loading}
            busyState={profileHook.busyState}
            error={profileHook.error}
            exportProfiles={profileHook.exportProfiles}
            importProfiles={profileHook.importProfiles}
            clearError={profileHook.clearError}
          />
        </div>
      )}

      {profilePendingSwitch !== null && (
        <ConfirmModal
          title="Unsaved Session Warning"
          message={
            <span>
              You are currently on an <strong>unsaved session</strong>.
              <br />
              <br />
              Switching to <strong>"{profilePendingSwitch.name}"</strong> will overwrite your current active cookies and log you out of this session unless you save it first.
            </span>
          }
          confirmLabel="Switch anyway"
          cancelLabel="Stay & save"
          isDestructive={false}
          onConfirm={async () => {
            const targetId = profilePendingSwitch.id;
            setProfilePendingSwitch(null);
            await profileHook.switchProfile(targetId);
          }}
          onCancel={() => setProfilePendingSwitch(null)}
        />
      )}

      {profilePendingDelete !== null && (
        <ConfirmModal
          title="Delete Profile?"
          message={
            <span>
              Are you sure you want to delete profile <strong>"{profilePendingDelete.name}"</strong>?
              <br />
              Stored session cookies for this account will be permanently removed.
            </span>
          }
          confirmLabel="Delete Profile"
          cancelLabel="Cancel"
          isDestructive={true}
          onConfirm={async () => {
            const targetId = profilePendingDelete.id;
            setProfilePendingDelete(null);
            await profileHook.deleteProfile(targetId);
          }}
          onCancel={() => setProfilePendingDelete(null)}
        />
      )}
    </main>
  );
};