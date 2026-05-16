/**
 * Factory functions for Supabase clients in Edge Functions.
 *
 * - createCallerClient: uses the request's Authorization header (user JWT).
 *   Subject to RLS. Use for authorization checks.
 * - createServiceClient: uses the SERVICE_ROLE_KEY.
 *   Bypasses RLS. Use only for authoritative inserts after validation.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Caller-scoped client — respects RLS policies. */
export function createCallerClient(authorizationHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorizationHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client — bypasses RLS. Use only for authoritative writes. */
export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
