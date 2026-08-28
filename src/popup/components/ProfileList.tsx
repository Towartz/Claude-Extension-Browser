import React from 'react';
import { Profile } from '../../types';
import { isExpired } from '../../utils';
import { BusyState } from '../hooks/useProfiles';
import { ProfileItem } from './ProfileItem';

export interface ProfileListProps {
  profiles: Profile[];
  activeProfileId?: string;
  isClaudeTab: boolean;
  loading: boolean;
  busyState: BusyState;
  onSwitch: (id: string) => Promise<void> | void;
  onDelete: (profile: Profile) => void;
  onRename: (id: string, name: string) => Promise<void>;
}

export const ProfileList: React.FC<ProfileListProps> = ({
  profiles,
  activeProfileId,
  isClaudeTab,
  loading,
  busyState,
  onSwitch,
  onDelete,
  onRename
}) => {
  if (loading) {
    return <section className="list-card muted-state">Loading saved profiles…</section>;
  }

  if (profiles.length === 0) {
    return (
      <section className="list-card empty-state">
        <h2>No profiles saved yet.</h2>
        <p>
          Log in to Claude and hit <strong>Save current</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="list-card profile-list" aria-label="Saved Claude profiles">
      {profiles.map((profile) => (
        <ProfileItem
          key={profile.id}
          profile={profile}
          isActive={profile.id === activeProfileId}
          isClaudeTab={isClaudeTab}
          onSwitch={onSwitch}
          onDelete={onDelete}
          onRename={onRename}
          switching={busyState === 'switching'}
          disabled={busyState !== 'idle'}
          stale={isExpired(profile)}
        />
      ))}
    </section>
  );
};
