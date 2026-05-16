import { useState, useEffect, useCallback } from 'react';
import { fetchOwnProfile, updateOwnDisplayName } from './accountApi';
import type { UserProfile } from './types';

export interface UseAccountProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  updateDisplayName: (name: string) => Promise<boolean>;
  refresh: () => void;
}

export function useAccountProfile(userId: string | null): UseAccountProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const result = await fetchOwnProfile(userId);
    setLoading(false);
    if (result.ok && result.data) {
      setProfile(result.data);
    } else {
      setError(result.message ?? 'Could not load profile.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDisplayName = useCallback(
    async (name: string): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      setSaveError(null);
      const result = await updateOwnDisplayName(userId, { displayName: name });
      setSaving(false);
      if (result.ok) {
        setProfile((prev) => (prev ? { ...prev, displayName: name.trim() } : prev));
        return true;
      }
      setSaveError(result.message ?? 'Could not save changes.');
      return false;
    },
    [userId],
  );

  return { profile, loading, error, saving, saveError, updateDisplayName, refresh: load };
}
