import React, { useEffect, useRef, useState } from 'react';
import { BusyState } from '../hooks/useProfiles';
import { isEncryptedPayload } from '../../utils';
import { Icon } from './Icons';
import { PassphraseModal } from './PassphraseModal';

export interface TransferPanelProps {
  profilesCount: number;
  loading: boolean;
  busyState: BusyState;
  error: string | null;
  exportProfiles: (passphrase: string) => Promise<boolean>;
  importProfiles: (fileOrText: File | string, passphrase?: string) => Promise<boolean>;
  clearError: () => void;
}

function isFirefox(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /firefox|fxios/i.test(navigator.userAgent) ||
    typeof (globalThis as any).browser?.runtime?.getBrowserInfo === 'function'
  );
}

function isPopupView(): boolean {
  if (typeof window === 'undefined') return true;
  const isTabParam = new URLSearchParams(window.location.search).get('mode') === 'tab';
  return !isTabParam && window.innerWidth <= 480;
}

export const TransferPanel: React.FC<TransferPanelProps> = ({
  profilesCount,
  loading,
  busyState,
  error,
  exportProfiles,
  importProfiles,
  clearError
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Passphrase modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'import' | 'export'>('export');
  const [pendingImportContent, setPendingImportContent] = useState<File | string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const isBusy = busyState !== 'idle';
  const isExporting = busyState === 'exporting';
  const isImporting = busyState === 'importing';

  // In dedicated tab mode, if navigated with #import, auto-trigger the file picker
  useEffect(() => {
    const hash = window.location.hash;
    const search = new URLSearchParams(window.location.search);
    if (hash === '#import' || search.get('action') === 'import') {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search.replace(/([&?])action=import&?/, '$1')
      );
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleOpenExportModal() {
    setSuccessMessage(null);
    clearError();
    setModalError(null);
    setModalMode('export');
    setModalOpen(true);
  }

  async function handleExportSubmit(passphrase: string) {
    const ok = await exportProfiles(passphrase);
    if (ok) {
      setSuccessMessage('Encrypted profiles exported successfully.');
      setModalOpen(false);
    }
  }

  async function executeImport(content: File | string, passphrase?: string): Promise<boolean> {
    const ok = await importProfiles(content, passphrase);
    if (ok) {
      setSuccessMessage('Profiles imported successfully.');
      setPastedJson('');
      setPendingImportContent(null);
      setModalOpen(false);
      return true;
    }
    return false;
  }

  async function processContentForImport(content: File | string) {
    setSuccessMessage(null);
    clearError();
    setPasteError(null);
    setModalError(null);

    try {
      const text = typeof content === 'string' ? content.trim() : await content.text();
      if (!text) {
        throw new Error('File or pasted text is empty.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new SyntaxError('Choose a valid profiles JSON file or paste valid JSON.');
      }

      if (isEncryptedPayload(parsed)) {
        // Requires passphrase to decrypt
        setPendingImportContent(content);
        setModalMode('import');
        setModalOpen(true);
        return;
      }

      // Plaintext / unencrypted payload
      await executeImport(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import profiles.';
      if (typeof content === 'string') {
        setPasteError(msg);
      } else {
        setModalError(msg);
      }
    } finally {
      setIsDragActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleTriggerFileInput() {
    if (isFirefox() && isPopupView()) {
      // Firefox Bug 1378527 / 1658694:
      // Opening an OS file dialog from a popup panel auto-closes the popup on blur.
      // Open in a dedicated tab where native file picker works 100% reliably.
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html?tab=transfer&mode=tab#import')
        });
        return;
      }
    }
    fileInputRef.current?.click();
  }

  function handleOpenInTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup.html?tab=transfer&mode=tab')
      });
    }
  }

  return (
    <section className="tab-panel transfer-panel" aria-label="Import and export profiles" role="tabpanel">
      <header className="transfer-header">
        <div className="transfer-mark">
          <Icon name="transfer" size={22} />
        </div>
        <div className="transfer-header-text">
          <div className="transfer-title-row">
            <h2>Import & Export Profiles</h2>
            {isPopupView() && (
              <button
                type="button"
                className="open-tab-btn"
                onClick={handleOpenInTab}
                title="Open in dedicated browser tab"
                aria-label="Open in tab"
              >
                <Icon name="external" size={13} />
                <span>Open Tab</span>
              </button>
            )}
          </div>
          <p>Back up or transfer your saved profiles.</p>
        </div>
      </header>

      <div className="feedback-region" aria-live="polite">
        {error !== null && (
          <div className="feedback feedback-error" role="alert">
            <span>{error}</span>
            <button type="button" aria-label="Dismiss error" onClick={clearError}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {error === null && successMessage !== null && (
          <div className="feedback feedback-success">{successMessage}</div>
        )}
      </div>

      {profilesCount > 0 && (
        <section className="transfer-section" aria-labelledby="export-title">
          <div className="section-heading">
            <h3 id="export-title">Export Profiles</h3>
            <p>Export all your saved accounts and settings as an encrypted JSON file.</p>
          </div>
          <div className="file-preview">
            <div className="file-icon">
              <Icon name="document" size={21} />
            </div>
            <div className="file-details">
              <strong>claude-profiles-backup.json</strong>
              <span>
                Encrypted with AES-GCM <span aria-hidden="true">•</span> PBKDF2
              </span>
            </div>
            <button
              type="button"
              className="transfer-button export-button"
              disabled={loading || isBusy}
              onClick={handleOpenExportModal}
            >
              {isExporting ? 'Exporting…' : 'Export Profiles'}
            </button>
          </div>
        </section>
      )}

      <section
        className={`transfer-section import-section${profilesCount === 0 ? ' import-section-first' : ''}`}
        aria-labelledby="import-title"
      >
        <div className="section-heading">
          <h3 id="import-title">Import Profiles</h3>
          <p>Import profiles from a previously exported JSON file or paste backup data.</p>
        </div>

        {isFirefox() && isPopupView() && (
          <div className="firefox-notice-card">
            <div className="firefox-notice-icon">
              <Icon name="info" size={14} />
            </div>
            <p>
              Firefox closes popup windows when file pickers open.{' '}
              <button type="button" className="firefox-inline-link" onClick={handleTriggerFileInput}>
                Click here to import via tab
              </button>{' '}
              or paste JSON directly below.
            </p>
          </div>
        )}

        <div
          className={`drop-zone${isDragActive ? ' is-drag-active' : ''}${isImporting ? ' is-busy' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload JSON file"
          onClick={handleTriggerFileInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTriggerFileInput();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!isBusy && !loading) setIsDragActive(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragActive(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!isBusy && !loading && e.dataTransfer.files[0]) {
              processContentForImport(e.dataTransfer.files[0]);
            }
          }}
        >
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            aria-label="Choose profiles JSON file"
            disabled={loading || isBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processContentForImport(f);
            }}
          />
          <span className="upload-icon">
            <Icon name="upload" size={24} />
          </span>
          <strong>{isImporting ? 'Importing your profiles…' : 'Drag and drop JSON file here'}</strong>
          <span>{isImporting ? 'Please wait…' : isFirefox() && isPopupView() ? 'or click to open in tab & browse' : 'or click to browse'}</span>
        </div>

        <div className="import-action-bar">
          <button
            type="button"
            className="transfer-button import-button"
            disabled={loading || isBusy}
            onClick={handleTriggerFileInput}
          >
            {isImporting ? 'Importing…' : 'Import Profiles'}
          </button>

          <button
            type="button"
            className="toggle-paste-button"
            onClick={() => setShowPasteMode((prev) => !prev)}
          >
            <Icon name="document" size={13} />
            <span>{showPasteMode ? 'Hide Paste Area' : 'Paste JSON Directly'}</span>
          </button>
        </div>

        {showPasteMode && (
          <div className="paste-json-container">
            <label htmlFor="pasted-json-input" className="paste-json-label">
              Paste exported JSON (encrypted or plaintext):
            </label>
            <textarea
              id="pasted-json-input"
              className="paste-json-textarea"
              rows={4}
              value={pastedJson}
              placeholder='{"version": 2, "encrypted": true, ...}'
              onChange={(e) => {
                setPastedJson(e.target.value);
                if (pasteError) setPasteError(null);
              }}
              disabled={loading || isBusy}
            />
            {pasteError && (
              <div className="paste-field-error" role="alert">
                {pasteError}
              </div>
            )}
            <div className="paste-json-actions">
              <button
                type="button"
                className="transfer-button import-button paste-submit-btn"
                disabled={loading || isBusy || !pastedJson.trim()}
                onClick={() => processContentForImport(pastedJson)}
              >
                {isImporting ? 'Importing…' : 'Import from Pasted JSON'}
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="security-card">
        <span className="security-icon">
          <Icon name="lock" size={14} />
        </span>
        <p>Exported files contain session cookies — keep them private and treat them like credentials.</p>
      </aside>

      <PassphraseModal
        isOpen={modalOpen}
        mode={modalMode}
        error={modalError}
        onSubmit={async (passphrase) => {
          if (modalMode === 'export') {
            await handleExportSubmit(passphrase);
          } else if (pendingImportContent !== null) {
            await executeImport(pendingImportContent, passphrase);
          }
        }}
        onCancel={() => {
          setModalOpen(false);
          setPendingImportContent(null);
          setModalError(null);
        }}
      />
    </section>
  );
};
