import React, { useRef, useState } from 'react';
import { BusyState } from '../hooks/useProfiles';
import { Icon } from './Icons';

export interface TransferPanelProps {
  profilesCount: number;
  loading: boolean;
  busyState: BusyState;
  error: string | null;
  exportProfiles: () => Promise<boolean>;
  importProfiles: (file: File) => Promise<boolean>;
  clearError: () => void;
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

  const isBusy = busyState !== 'idle';
  const isExporting = busyState === 'exporting';
  const isImporting = busyState === 'importing';

  async function handleExport() {
    setSuccessMessage(null);
    try {
      const ok = await exportProfiles();
      if (ok) {
        setSuccessMessage('Encrypted profiles exported successfully.');
      }
    } catch {
      setSuccessMessage(null);
    }
  }

  async function handleFileSelect(file?: File) {
    if (!file) return;
    setSuccessMessage(null);
    clearError();
    try {
      const ok = await importProfiles(file);
      if (ok) {
        setSuccessMessage('Profiles imported successfully.');
      }
    } catch {
      setSuccessMessage(null);
    } finally {
      setIsDragActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <section className="tab-panel transfer-panel" aria-label="Import and export profiles" role="tabpanel">
      <header className="transfer-header">
        <div className="transfer-mark">
          <Icon name="transfer" size={22} />
        </div>
        <div>
          <h2>Import & Export Profiles</h2>
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
              onClick={handleExport}
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
          <p>Import profiles from a previously exported JSON file.</p>
        </div>

        <label
          className={`drop-zone${isDragActive ? ' is-drag-active' : ''}${isImporting ? ' is-busy' : ''}`}
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
              handleFileSelect(e.dataTransfer.files[0]);
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
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
          <span className="upload-icon">
            <Icon name="upload" size={24} />
          </span>
          <strong>{isImporting ? 'Importing your profiles…' : 'Drag and drop JSON file here'}</strong>
          <span>{isImporting ? 'Please keep this popup open.' : 'or click to browse'}</span>
        </label>

        <button
          type="button"
          className="transfer-button import-button"
          disabled={loading || isBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          {isImporting ? 'Importing…' : 'Import Profiles'}
        </button>
      </section>

      <aside className="security-card">
        <span className="security-icon">
          <Icon name="lock" size={14} />
        </span>
        <p>Exported files contain session cookies — keep them private and treat them like credentials.</p>
      </aside>
    </section>
  );
};
