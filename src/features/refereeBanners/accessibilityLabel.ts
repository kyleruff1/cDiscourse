/**
 * MCP-014 — Referee banner: screen-reader label builder.
 *
 * `buildBannerAccessibilityLabel` produces the complete screen-reader sentence
 * a banner carries (MCP-008 §8.1): a full sentence with the tone stated in
 * words, so a non-color, non-glyph reading still conveys the tone. Pure: same
 * input → same output, no `Date.now()`, no randomness.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import type { RefereeBanner, RefereeBannerTone } from './types';

/**
 * Tone → prefix word. The render layer (a deferred follow-up card) and the
 * screen-reader label both read this. `celebratory` reads as a "note";
 * `nudge` / `routing_hint` read as a "suggestion" — a suggestion is never a
 * verdict and never a command.
 */
export const BANNER_TONE_PREFIX: Readonly<Record<RefereeBannerTone, string>> =
  Object.freeze({
    celebratory: 'note', // -> "<framingWord> note:"
    nudge: 'suggestion', // -> "<framingWord> suggestion:"
    routing_hint: 'suggestion',
  });

/**
 * Build the complete screen-reader sentence for a banner.
 *
 * Format: `"<framingWord> <tone-prefix>: <headline> <helperLine, if present>"`.
 *
 * Examples (framingWord = `Referee`):
 *   - celebratory → `"Referee note: Clean parent tie."`
 *   - nudge       → `"Referee suggestion: Source is here — the exact quote is still needed."`
 *   - routing_hint→ `"Referee suggestion: This probably belongs on a branch."`
 *
 * The function is pure: same input → same output. Changing `framingWord`
 * changes only the prefix; the headline / helper portion is byte-identical.
 * When `helperLine` is absent the label is built from `headline` alone — no
 * trailing space, no empty clause.
 */
export function buildBannerAccessibilityLabel(
  banner: Pick<RefereeBanner, 'tone' | 'headline' | 'helperLine'>,
  framingWord = 'Referee',
): string {
  const prefixWord = BANNER_TONE_PREFIX[banner.tone];
  const head = `${framingWord} ${prefixWord}: ${banner.headline.trim()}`;
  const helper = banner.helperLine ? banner.helperLine.trim() : '';
  if (helper.length === 0) return head;
  return `${head} ${helper}`;
}
