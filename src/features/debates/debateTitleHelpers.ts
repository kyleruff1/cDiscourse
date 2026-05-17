/**
 * Stage 6.1.8 — Pure validators / display helpers for debate titles.
 *
 * Pure TypeScript. No Supabase. No React Native. No network. Safe to import
 * from Node test environments and from server-side code.
 */

export const MAX_DEBATE_TITLE_CHARS = 120;

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

export function validateDebateTitle(raw: string | null | undefined): { ok: true; title: string } | { ok: false; error: string } {
  if (raw == null) return { ok: true, title: '' };
  const cleaned = String(raw).replace(CONTROL_CHARS, '').trim();
  if (cleaned.length > MAX_DEBATE_TITLE_CHARS) {
    return { ok: false, error: `Title must be ${MAX_DEBATE_TITLE_CHARS} characters or fewer.` };
  }
  return { ok: true, title: cleaned };
}

/** Pure helper for picking the displayed title for a debate. */
export function pickDisplayTitle(input: { debateTitle?: string | null; rootBody?: string | null; maxChars?: number }): string {
  const cap = typeof input.maxChars === 'number' && input.maxChars > 0 ? input.maxChars : MAX_DEBATE_TITLE_CHARS;
  const explicit = (input.debateTitle || '').trim();
  if (explicit) return explicit.length <= cap ? explicit : explicit.slice(0, cap - 1) + '…';
  const root = (input.rootBody || '').trim().replace(/\s+/g, ' ');
  if (root) return root.length <= cap ? root : root.slice(0, cap - 1) + '…';
  return 'Untitled argument';
}
