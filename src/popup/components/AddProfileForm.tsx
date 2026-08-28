import React, { useMemo, useState } from 'react';

export interface AddProfileFormProps {
  onSave: (name: string, colorIndex: number) => Promise<void>;
  existingNames: string[];
  disabled: boolean;
  nextColorIndex: number;
}

export const AddProfileForm: React.FC<AddProfileFormProps> = ({
  onSave,
  existingNames,
  disabled,
  nextColorIndex
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lowerNames = useMemo(() => existingNames.map((n) => n.toLocaleLowerCase()), [existingNames]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name for this profile.');
      return;
    }
    if (lowerNames.includes(trimmed.toLocaleLowerCase())) {
      setError('A profile with that name already exists.');
      return;
    }

    setError(null);
    try {
      await onSave(trimmed, nextColorIndex);
      setName('');
    } catch {}
  }

  return (
    <form className="add-profile-form" onSubmit={handleSubmit}>
      <label htmlFor="profile-name">Profile name</label>
      <div className="form-row">
        <input
          id="profile-name"
          type="text"
          maxLength={40}
          placeholder="Work, personal, client…"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          disabled={disabled}
        />
        <button type="submit" className="primary-button" disabled={disabled}>
          Save current
        </button>
      </div>
      {error !== null && <p className="field-error">{error}</p>}
    </form>
  );
};
