/**
 * Admin authorization helpers for Supabase Edge Functions.
 *
 * Pattern:
 *   1. Verify JWT via callerClient.auth.getUser()
 *   2. Load profile via serviceClient (RLS-bypassing, narrow query)
 *   3. Require profile.role === 'admin'
 *
 * Service-role/secret keys are server-only. Never expose them in responses.
 */
import { createCallerClient, createServiceClient } from './supabaseClients.ts';

export interface AdminCaller {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: 'user' | 'moderator' | 'admin';
}

export interface AdminAuthSuccess {
  ok: true;
  caller: AdminCaller;
  callerClient: ReturnType<typeof createCallerClient>;
  serviceClient: ReturnType<typeof createServiceClient>;
}

export interface AdminAuthFailure {
  ok: false;
  status: 401 | 403;
  reason: string;
}

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

/**
 * Authenticate and require admin role.
 * Returns clients on success, an error envelope on failure.
 *
 * On 401: missing or invalid Authorization header / user.
 * On 403: authenticated but profile.role !== 'admin'.
 */
export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { ok: false, status: 401, reason: 'missing_authorization' };
  }

  const callerClient = createCallerClient(authHeader);
  const serviceClient = createServiceClient();

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false, status: 401, reason: 'invalid_token' };
  }

  const userId = userData.user.id;
  const email = userData.user.email ?? null;

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, status: 401, reason: 'profile_not_found' };
  }

  if (profile.role !== 'admin') {
    return { ok: false, status: 403, reason: 'admin_required' };
  }

  return {
    ok: true,
    caller: {
      userId,
      email,
      displayName: (profile.display_name as string | null) ?? null,
      role: 'admin',
    },
    callerClient,
    serviceClient,
  };
}
