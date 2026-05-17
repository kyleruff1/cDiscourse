/**
 * Stage 6.1.8 — Debate title update path.
 *
 * The debate title is independent from the root argument body. Editing the
 * title NEVER mutates `public.arguments.body`. RLS on `public.debates` is
 * the authorization layer: only the creator and admins can UPDATE.
 *
 * Validation rules:
 *   - Title is trimmed.
 *   - Empty string is allowed → means "fall back to root claim excerpt".
 *   - Max 120 characters (clamped server-side by app validation; longer
 *     titles are rejected before the network call).
 *   - No control characters.
 *
 * No service-role usage. No public.arguments mutation. The client passes
 * its own JWT-authed Supabase client; the database refuses the UPDATE if
 * the caller is neither the creator nor an admin.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import {
  validateDebateTitle,
  MAX_DEBATE_TITLE_CHARS,
  pickDisplayTitle,
} from './debateTitleHelpers';

export { validateDebateTitle, MAX_DEBATE_TITLE_CHARS, pickDisplayTitle };

export type UpdateDebateTitleResult =
  | { ok: true; debateId: string; title: string }
  | { ok: false; error: string };

export async function updateDebateTitle(debateId: string, title: string | null): Promise<UpdateDebateTitleResult> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (!debateId || typeof debateId !== 'string') return { ok: false, error: 'debateId required' };
  const validated = validateDebateTitle(title);
  if (!validated.ok) return { ok: false, error: validated.error };
  // RLS on `public.debates` is the authorization layer: it enforces
  // "creator OR admin only". The network call itself is the authorization
  // check. Empty string is allowed and means "fall back to root claim
  // excerpt on display".
  const { data, error } = await supabase
    .from('debates')
    .update({ title: validated.title })
    .eq('id', debateId)
    .select('id, title')
    .single();
  if (error) {
    // Sanitize Supabase errors before returning to the UI.
    const safeMessage = String(error.message || '').slice(0, 240);
    return { ok: false, error: `updateDebateTitle failed: ${safeMessage}` };
  }
  if (!data) return { ok: false, error: 'updateDebateTitle failed: no row updated (insufficient permissions or row missing).' };
  return { ok: true, debateId: data.id, title: data.title || '' };
}
