import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

export interface PassphraseModalProps {
  isOpen: boolean;
  mode: 'import' | 'export';
  title?: string;
  description?: string;
  error?: string | null;
  onSubmit: (passphrase: string) => Promise<void> | void;
  onCancel: () => void;
}

export const PassphraseModal: React.FC<PassphraseModalProps> = ({
  isOpen,
  mode,
  title,
  description,
  error: externalError,
  onSubmit,
  onCancel
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassphrase('');
      setLocalError(null);
      setSubmitting(false);
      setShowPassword(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onCancel]);

  if (!isOpen) return null;

  const defaultTitle = mode === 'export' ? 'Create Backup Passphrase' : 'Enter Backup Passphrase';
  const defaultDesc =
    mode === 'export'
      ? 'Set a passphrase to encrypt your backup file (minimum 8 characters). You will need this passphrase to import your profiles.'
      : 'Enter the passphrase that was used to encrypt this backup.';

  const displayError = localError || externalError;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError(null);

    const trimmed = passphrase.trim();
    if (!trimmed) {
      setLocalError('Please enter a passphrase.');
      return;
    }

    if (mode === 'export' && trimmed.length < 8) {
      setLocalError('Passphrase must be at least 8 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(trimmed);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Invalid passphrase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={submitting ? undefined : onCancel} role="presentation">
      <div
        className="modal-dialog passphrase-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passphrase-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-icon">
          <Icon name="lock" size={20} />
        </div>

        <h3 id="passphrase-modal-title" className="modal-title">
          {title || defaultTitle}
        </h3>

        <p className="modal-message">
          {description || defaultDesc}
        </p>

        <form onSubmit={handleSubmit} className="passphrase-form">
          <div className="passphrase-input-wrap">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              className="passphrase-input"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder={mode === 'export' ? 'Minimum 8 characters' : 'Enter backup passphrase'}
              disabled={submitting}
              autoComplete={mode === 'export' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="toggle-password-visibility"
              aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={submitting}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={14} />
            </button>
          </div>

          {displayError && (
            <div className="modal-field-error" role="alert">
              {displayError}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-button cancel"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button confirm"
              disabled={submitting || (mode === 'export' && passphrase.trim().length < 8)}
            >
              {submitting ? 'Processing…' : mode === 'export' ? 'Export' : 'Decrypt & Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
