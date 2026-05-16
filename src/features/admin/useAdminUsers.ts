/**
 * useAdminUsers — fetch the user list via admin-users Edge Function.
 * Client role check is UX only; server enforces admin.
 */
import { useState, useEffect, useCallback } from 'react';
import { adminListUsers, adminErrorMessage } from './adminApi';
import type { AdminUserSummary } from './types';
import type { ProfileRole } from '../account/types';

export interface UseAdminUsersResult {
  users: AdminUserSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setSearch: (s: string) => void;
  setRole: (r: ProfileRole | undefined) => void;
  setBotOnly: (b: boolean) => void;
  search: string;
  role: ProfileRole | undefined;
  botOnly: boolean;
}

export function useAdminUsers(): UseAdminUsersResult {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<ProfileRole | undefined>(undefined);
  const [botOnly, setBotOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await adminListUsers({
      search: search.trim() || undefined,
      role,
      botOnly: botOnly || undefined,
      perPage: 50,
    });
    setLoading(false);
    if (result.ok) {
      setUsers(result.data.users);
    } else {
      setError(adminErrorMessage(result.error, result.status));
    }
  }, [search, role, botOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    users,
    loading,
    error,
    refresh: load,
    setSearch,
    setRole,
    setBotOnly,
    search,
    role,
    botOnly,
  };
}
