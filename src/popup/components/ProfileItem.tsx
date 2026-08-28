import React, { useRef, useState, useEffect } from 'react';
import { Profile } from '../../types';
import { formatRelativeDate, formatUsageStatus, maskEmail, maskIfEmail } from '../../utils';

export interface ProfileItemProps {
  profile: Profile;
  isActive: boolean;
  isClaudeTab: boolean;
  onSwitch: (id: string) => Promise<void> | void;
  onDelete: (profile: Profile) => void;
  onRename: (id: string, name: string) => Promise<void>;
  switching: boolean;
  disabled: boolean;
  stale: boolean;
}

export const ProfileItem: React.FC<ProfileItemProps> = React.memo(({
  profile,
  isActive,
  isClaudeTab,
  onSwitch,
  onDelete,
  onRename,
  switching,
  disabled,
  stale
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const usageStatus = formatUsageStatus(profile.usage);

  useEffect(() => {
    setNameInput(profile.name);
  }, [profile.name]);

  async function handleRenameSubmit() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setRenameError('Please enter a name for this profile.');
      inputRef.current?.focus();
      return;
    }
    if (trimmed === profile.name) {
      setIsEditing(false);
      setRenameError(null);
      return;
    }
    setIsSaving(true);
    try {
      await onRename(profile.id, trimmed);
      setIsEditing(false);
      setRenameError(null);
    } catch {
      // Previously this failed silently, leaving the input open with no
      // explanation. Surface it and keep focus so the person can retry.
      setRenameError("Couldn't save that name. Try again.");
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setNameInput(profile.name);
      setIsEditing(false);
      setRenameError(null);
    }
  }

  const initialLetter = profile.name.trim().charAt(0).toLocaleUpperCase() || 'C';

  return (
    <article className={`pr${isActive ? ' active' : ''}`}>
      <div className={`av av-${profile.colorIndex}`} aria-hidden="true" title={profile.name}>
        {initialLetter}
      </div>

      <div className="pm">
        {isEditing ? (
          <div className="rename-row">
            <input
              ref={inputRef}
              className="rename-input"
              value={nameInput}
              maxLength={40}
              autoFocus
              onChange={(e) => {
                setNameInput(e.target.value);
                setRenameError(null);
              }}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              disabled={disabled || isSaving}
              aria-label={`Rename ${profile.name}`}
              aria-invalid={renameError !== null}
              aria-describedby={renameError !== null ? `rename-error-${profile.id}` : undefined}
            />
            {isSaving && <span className="spinner" aria-hidden="true" />}
          </div>
        ) : (
          <button
            type="button"
            className="pnb"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
            title="Rename profile"
          >
            <span className="pn" title={profile.name}>{maskIfEmail(profile.name)}</span>
            <svg
              className="ei"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 9l5.5-5.5 1.5 1.5L3.5 10.5H2V9z" />
              <path d="M7.5 3.5l1-1 1 1-1 1z" />
            </svg>
          </button>
        )}

        <div className="meta">
          {profile.email && (
            <>
              <span className="em" title={profile.email}>
                {maskEmail(profile.email)}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{formatRelativeDate(profile.savedAt)}</span>
          {isActive && <span className="active-badge">Active</span>}
          {stale && <span className="stale-badge">stale</span>}
          {renameError !== null && (
            <span id={`rename-error-${profile.id}`} className="field-error inline-error" role="alert">
              {renameError}
            </span>
          )}
        </div>

        {Boolean(usageStatus && usageStatus.pct > 0 && profile.plan !== 'Free') && usageStatus && (
          <>
            <div
              className="track"
              role="progressbar"
              aria-valuenow={Math.round(usageStatus.pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={usageStatus.label}
            >
              <div
                className={`fill fill-${usageStatus.status === 'warning' ? 'warn' : usageStatus.status}`}
                style={{ width: `${usageStatus.pct}%` }}
              />
            </div>
            <div className="ulabel">
              {usageStatus.pctString}% {usageStatus.timeStr ? `· ${usageStatus.timeStr}` : ''}
            </div>
          </>
        )}
      </div>

      <div className="pa">
        {!isActive && (
          <button
            type="button"
            className="sw"
            onClick={() => onSwitch(profile.id)}
            disabled={disabled || !isClaudeTab || switching}
            aria-label={switching ? `Switching to ${profile.name}` : `Switch to ${profile.name}`}
            title={!isClaudeTab ? 'Open a Claude tab to switch profiles' : undefined}
          >
            {switching ? <span className="spinner" aria-hidden="true" /> : 'Switch'}
          </button>
        )}

        <button
          type="button"
          className="del"
          onClick={() => onDelete(profile)}
          disabled={disabled}
          title={`Delete ${profile.name}`}
          aria-label={`Delete ${profile.name}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>
    </article>
  );
});